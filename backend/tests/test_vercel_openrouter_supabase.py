import asyncio
import json
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from PIL import Image
from sqlalchemy.pool import NullPool

from app.config import Settings
from app.database import prepare_async_engine_config
from app.models.item import ClothingItem, ItemStatus
from app.models.outfit import TimeOfDay
from app.services import suggestion_cache
from app.services.ai_service import AIService, TextGenerationResult
from app.services.image_service import ImageService, _ensured_supabase_buckets
from app.services.recommendation_service import RecommendationService
from app.services.weather_service import WeatherData
from app.utils.rate_limit import check_rate_limit
from app.utils.redis_lock import RedisDisabledError, distributed_lock, get_redis
from app.workers.tagging import tag_item_image


def _make_jpeg_bytes(size: tuple[int, int] = (320, 240), color: tuple[int, int, int] = (30, 80, 180)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


class TestServerlessAndSupabaseSettings:
    def test_database_url_normalizes_postgres_schemes(self):
        s1 = Settings(
            _env_file=None,
            database_url="postgres://postgres.ref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
        )
        assert str(s1.database_url).startswith("postgresql+asyncpg://")

        s2 = Settings(
            _env_file=None,
            database_url="postgresql://postgres.ref:secret@db.ref.supabase.co:5432/postgres",
        )
        assert str(s2.database_url).startswith("postgresql+asyncpg://")

    def test_postgres_url_alias_supported_for_vercel_supabase_integration(self, monkeypatch):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        monkeypatch.setenv(
            "POSTGRES_URL",
            "postgres://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x",
        )
        cfg = Settings(_env_file=None)
        clean_url, kwargs = prepare_async_engine_config(str(cfg.database_url), cfg)
        assert clean_url.startswith("postgresql+asyncpg://postgres.ref:pw@")
        assert "supa=" not in clean_url
        assert "sslmode=" not in clean_url
        assert "ssl=require" in clean_url
        assert kwargs["connect_args"]["statement_cache_size"] == 0

    def test_postgres_18_direct_tls_and_channel_binding_params_sanitized(self):
        cfg = Settings(
            _env_file=None,
            database_url=(
                "postgresql://wardrobe:pw@pg18.example.com:5432/wardrobe"
                "?sslnegotiation=direct&channel_binding=require&gssencmode=disable"
            ),
        )
        clean_url, kwargs = prepare_async_engine_config(str(cfg.database_url), cfg)
        assert "channel_binding=" not in clean_url
        assert "gssencmode=" not in clean_url
        assert "sslnegotiation=direct" in clean_url
        assert "ssl=require" in clean_url
        assert "connect_args" not in kwargs or kwargs["connect_args"].get("ssl") is not False

    def test_vercel_env_enables_nullpool_inline_queue_and_tmp_fallback(self, monkeypatch):
        monkeypatch.setenv("VERCEL", "1")
        monkeypatch.delenv("REDIS_URL", raising=False)
        monkeypatch.delenv("STORAGE_PATH", raising=False)
        cfg = Settings(_env_file=None)

        assert cfg.is_serverless is True
        assert cfg.redis_enabled is False
        assert cfg.effective_job_queue_mode == "inline"
        assert cfg.effective_local_storage_path == "/tmp/wardrobe"

        _, kwargs = prepare_async_engine_config(str(cfg.database_url), cfg)
        assert kwargs["poolclass"] is NullPool
        assert kwargs["connect_args"]["statement_cache_size"] == 0

    def test_supabase_storage_auto_detection(self):
        local_cfg = Settings(_env_file=None)
        assert local_cfg.effective_storage_backend == "local"

        supa_cfg = Settings(
            _env_file=None,
            supabase_url="https://xyzcompany.supabase.co/",
            supabase_service_role_key="service-role-token",
        )
        assert supa_cfg.supabase_url == "https://xyzcompany.supabase.co"
        assert supa_cfg.effective_storage_backend == "supabase"

    @pytest.mark.asyncio
    async def test_redis_disabled_bypasses_cache_locks_and_rate_limits(self):
        disabled_cfg = Settings(_env_file=None, redis_url="none")
        assert disabled_cfg.redis_url is None
        assert disabled_cfg.redis_enabled is False
        assert disabled_cfg.effective_job_queue_mode == "inline"

        with (
            patch("app.utils.redis_lock.get_settings", return_value=disabled_cfg),
            patch("app.utils.rate_limit.get_settings", return_value=disabled_cfg),
        ):
            with pytest.raises(RedisDisabledError):
                await get_redis()

            async with distributed_lock("test-lock"):
                pass

            await check_rate_limit("rate_limit:test", limit=1, window_seconds=60)
            await suggestion_cache.push_suggestions(uuid4(), "casual", [{"items": [1, 2]}])
            assert await suggestion_cache.pop_suggestion(uuid4(), "casual") is None
            assert await suggestion_cache.has_cached(uuid4(), "casual") is False


class TestOpenRouterAndParallelModels:
    def test_comma_separated_models_expand_and_set_openrouter_headers(self):
        cfg = Settings(
            _env_file=None,
            ai_base_url="https://openrouter.ai/api/v1",
            ai_api_key="test-key",
            ai_vision_model="google/gemma-4-31b-it:free,thinkingmachines/inkling:free",
            ai_text_model="google/gemma-4-31b-it:free,thinkingmachines/inkling:free",
            app_url="https://wardrowbe-api.vercel.app",
            app_name="Wardrowbe",
        )
        with patch("app.services.ai_service.get_settings", return_value=cfg):
            service = AIService()

        assert len(service._endpoints) == 2
        assert [ep.text_model for ep in service._endpoints] == [
            "google/gemma-4-31b-it:free",
            "thinkingmachines/inkling:free",
        ]
        assert service.has_multiple_text_models() is True

        headers = service._get_headers("https://openrouter.ai/api/v1")
        assert headers["Authorization"] == "Bearer test-key"
        assert headers["HTTP-Referer"] == "https://wardrowbe-api.vercel.app"
        assert headers["X-Title"] == "Wardrowbe"

    @pytest.mark.asyncio
    async def test_analyze_image_accepts_raw_bytes(self):
        service = AIService()
        raw_jpeg = _make_jpeg_bytes((800, 600))
        call = AsyncMock(
            side_effect=[
                ('{"type": "shirt", "primary_color": "blue", "colors": ["blue"]}', None, None),
                ("A classic blue shirt", None, None),
            ]
        )
        with patch.object(service, "_call_with_fallback", call):
            tags = await service.analyze_image(raw_jpeg, locale="en")

        assert tags.type == "shirt"
        assert tags.primary_color == "blue"
        assert tags.description == "A classic blue shirt"
        sent_url = call.call_args_list[0].args[0][1]["content"][0]["image_url"]["url"]
        assert sent_url.startswith("data:image/jpeg;base64,")

    @pytest.mark.asyncio
    async def test_generate_text_parallel_calls_both_models_simultaneously(self):
        cfg = Settings(
            _env_file=None,
            ai_base_url="https://openrouter.ai/api/v1",
            ai_api_key="test-key",
            ai_text_model="google/gemma-4-31b-it:free,thinkingmachines/inkling:free",
            ai_max_retries=1,
        )
        with patch("app.services.ai_service.get_settings", return_value=cfg):
            service = AIService()

        in_flight = 0
        max_concurrent = 0

        async def fake_post(self_client, url, **kwargs):
            nonlocal in_flight, max_concurrent
            in_flight += 1
            max_concurrent = max(max_concurrent, in_flight)
            await asyncio.sleep(0.02)
            in_flight -= 1
            model = kwargs["json"]["model"]
            req = httpx.Request("POST", url)
            return httpx.Response(
                200,
                json={
                    "model": model,
                    "choices": [
                        {
                            "message": {"content": json.dumps({"from_model": model})},
                            "finish_reason": "stop",
                        }
                    ],
                },
                request=req,
            )

        with patch("httpx.AsyncClient.post", new=fake_post):
            results = await service.generate_text_parallel("Generate outfits")

        assert max_concurrent == 2
        assert [r.model for r in results] == [
            "google/gemma-4-31b-it:free",
            "thinkingmachines/inkling:free",
        ]

    @pytest.mark.asyncio
    async def test_generate_text_parallel_survives_partial_403_or_429_failure(self):
        cfg = Settings(
            _env_file=None,
            ai_base_url="https://openrouter.ai/api/v1",
            ai_api_key="test-key",
            ai_text_model="google/gemma-4-31b-it:free,thinkingmachines/inkling:free",
            ai_max_retries=1,
        )
        with patch("app.services.ai_service.get_settings", return_value=cfg):
            service = AIService()

        async def fake_post(self_client, url, **kwargs):
            model = kwargs["json"]["model"]
            req = httpx.Request("POST", url)
            if "inkling" in model:
                return httpx.Response(
                    403,
                    json={"error": {"message": "gated endpoint", "code": 403}},
                    request=req,
                )
            return httpx.Response(
                200,
                json={
                    "model": model,
                    "choices": [
                        {
                            "message": {"content": '{"outfits": [{"items": [1, 2]}]}'},
                            "finish_reason": "stop",
                        }
                    ],
                },
                request=req,
            )

        with patch("httpx.AsyncClient.post", new=fake_post):
            results = await service.generate_text_parallel("Generate outfits")

        assert len(results) == 1
        assert isinstance(results[0], TextGenerationResult)
        assert results[0].model == "google/gemma-4-31b-it:free"

    @pytest.mark.asyncio
    async def test_recommendation_service_interleaves_and_deduplicates_parallel_models(self):
        from datetime import UTC, datetime

        user_id = uuid4()
        user = MagicMock()
        user.id = user_id
        user.preferences = None
        user.timezone = "UTC"
        user.location_lat = 40.7
        user.body_measurements = None

        shirt_1 = ClothingItem(
            id=uuid4(), user_id=user_id, type="shirt", primary_color="white", status=ItemStatus.ready
        )
        shirt_2 = ClothingItem(
            id=uuid4(), user_id=user_id, type="t-shirt", primary_color="navy", status=ItemStatus.ready
        )
        pants = ClothingItem(
            id=uuid4(), user_id=user_id, type="pants", primary_color="black", status=ItemStatus.ready
        )
        shoes = ClothingItem(
            id=uuid4(),
            user_id=user_id,
            type="sneakers",
            primary_color="white",
            status=ItemStatus.ready,
        )
        boots = ClothingItem(
            id=uuid4(),
            user_id=user_id,
            type="boots",
            primary_color="brown",
            status=ItemStatus.ready,
        )
        candidates = [shirt_1, shirt_2, pants, shoes, boots]
        number_map = {
            1: shirt_1.id,
            2: shirt_2.id,
            3: pants.id,
            4: shoes.id,
            5: boots.id,
        }

        ai = MagicMock()
        ai.has_multiple_text_models = MagicMock(return_value=True)
        ai.generate_text_parallel = AsyncMock(
            return_value=[
                TextGenerationResult(
                    content=json.dumps(
                        {
                            "outfits": [
                                {"items": [1, 3, 4], "headline": "Gemma Option 1"},
                                {"items": [2, 3, 4], "headline": "Gemma Option 2"},
                            ]
                        }
                    ),
                    model="google/gemma-4-31b-it:free",
                    endpoint="default:google/gemma-4-31b-it:free",
                ),
                TextGenerationResult(
                    content=json.dumps(
                        {
                            "outfits": [
                                # Identical combo to Gemma Option 1 -> should be deduplicated
                                {"items": [1, 3, 4], "headline": "Inkling Duplicate"},
                                {"items": [2, 3, 5], "headline": "Inkling Unique"},
                            ]
                        }
                    ),
                    model="thinkingmachines/inkling:free",
                    endpoint="default:thinkingmachines/inkling:free",
                ),
            ]
        )

        saved_payloads: list[tuple[dict, list]] = []

        async def fake_save_outfit(od, item_ids, *_args, **_kwargs):
            saved_payloads.append((od, item_ids))
            fake_outfit = MagicMock()
            fake_outfit.ai_raw_response = od
            return fake_outfit

        weather = WeatherData(
            temperature=20.0,
            feels_like=20.0,
            humidity=50,
            precipitation_chance=10,
            precipitation_mm=0.0,
            wind_speed=10.0,
            condition="sunny",
            condition_code=0,
            is_day=True,
            uv_index=3.0,
            timestamp=datetime.now(UTC),
        )

        service = RecommendationService(AsyncMock())
        with (
            patch("app.services.recommendation_service.AIService", return_value=ai),
            patch("app.services.recommendation_service.pop_suggestion", AsyncMock(return_value=None)),
            patch("app.services.recommendation_service.push_suggestions", AsyncMock()),
            patch.object(service, "_get_today_rejected_item_ids", AsyncMock(return_value=set())),
            patch.object(service, "get_candidate_items", AsyncMock(return_value=candidates)),
            patch.object(service, "_get_recently_worn_dates", AsyncMock(return_value={})),
            patch.object(service, "_get_good_item_pairs", AsyncMock(return_value={})),
            patch.object(service, "_get_learned_preferences", AsyncMock(return_value={})),
            patch.object(
                service, "_get_recently_worn_outfit_combinations", AsyncMock(return_value=set())
            ),
            patch.object(
                service, "_get_recently_suggested_outfit_combinations", AsyncMock(return_value=set())
            ),
            patch.object(service, "_format_items_for_prompt", return_value=("", number_map)),
            patch.object(service, "_save_outfit", side_effect=fake_save_outfit),
        ):
            outfits = await service.generate_recommendations(
                user=user,
                occasion="casual",
                weather_override=weather,
                time_of_day=TimeOfDay.morning,
                count=3,
            )

        ai.generate_text_parallel.assert_awaited_once()
        assert len(outfits) == 3
        headlines_and_models = [(od["headline"], od["_ai_model"]) for od, _ in saved_payloads]
        assert headlines_and_models == [
            ("Gemma Option 1", "google/gemma-4-31b-it:free"),
            ("Gemma Option 2", "google/gemma-4-31b-it:free"),
            ("Inkling Unique", "thinkingmachines/inkling:free"),
        ]


class TestSupabaseImageStorageAndTagging:
    @pytest.mark.asyncio
    async def test_supabase_upload_download_rotate_and_delete_without_local_disk(self):
        _ensured_supabase_buckets.clear()
        supa_cfg = Settings(
            _env_file=None,
            storage_backend="supabase",
            supabase_url="https://projectref.supabase.co",
            supabase_service_role_key="supa-secret",
            supabase_storage_bucket="wardrobe",
        )
        bucket_objects: dict[str, bytes] = {}
        bucket_created = False

        async def fake_async_post(self_client, url: str, **kwargs):
            nonlocal bucket_created
            req = httpx.Request("POST", url)
            if url.endswith("/storage/v1/bucket"):
                bucket_created = True
                return httpx.Response(200, json={"name": "wardrobe"}, request=req)
            prefix = "https://projectref.supabase.co/storage/v1/object/wardrobe/"
            assert url.startswith(prefix)
            if not bucket_created:
                return httpx.Response(404, json={"message": "Bucket not found"}, request=req)
            key = url[len(prefix) :]
            bucket_objects[key] = kwargs["content"]
            return httpx.Response(200, json={"Key": f"wardrobe/{key}"}, request=req)

        async def fake_async_get(self_client, url: str, **kwargs):
            req = httpx.Request("GET", url)
            prefix = "https://projectref.supabase.co/storage/v1/object/wardrobe/"
            key = url[len(prefix) :]
            if key not in bucket_objects:
                return httpx.Response(404, json={"error": "not_found"}, request=req)
            return httpx.Response(200, content=bucket_objects[key], request=req)

        def fake_sync_post(self_client, url: str, **kwargs):
            req = httpx.Request("POST", url)
            prefix = "https://projectref.supabase.co/storage/v1/object/wardrobe/"
            key = url[len(prefix) :]
            bucket_objects[key] = kwargs["content"]
            return httpx.Response(200, json={"Key": f"wardrobe/{key}"}, request=req)

        def fake_sync_get(self_client, url: str, **kwargs):
            req = httpx.Request("GET", url)
            prefix = "https://projectref.supabase.co/storage/v1/object/wardrobe/"
            key = url[len(prefix) :]
            if key not in bucket_objects:
                return httpx.Response(404, json={"error": "not_found"}, request=req)
            return httpx.Response(200, content=bucket_objects[key], request=req)

        def fake_sync_request(self_client, method: str, url: str, **kwargs):
            req = httpx.Request(method, url)
            for k in kwargs.get("json", {}).get("prefixes", []):
                bucket_objects.pop(k, None)
            return httpx.Response(200, json=[], request=req)

        with (
            patch("app.services.image_service.get_settings", return_value=supa_cfg),
            patch("httpx.AsyncClient.post", new=fake_async_post),
            patch("httpx.AsyncClient.get", new=fake_async_get),
            patch("httpx.Client.post", new=fake_sync_post),
            patch("httpx.Client.get", new=fake_sync_get),
            patch("httpx.Client.request", new=fake_sync_request),
        ):
            svc = ImageService()
            assert svc.backend == "supabase"
            user_id = uuid4()
            raw = _make_jpeg_bytes((600, 400))

            paths = await svc.process_and_store(user_id, raw, "jacket.jpg")
            assert bucket_created is True
            assert len(bucket_objects) == 3

            fetched = await svc.read_image_bytes(paths["image_path"])
            assert Image.open(BytesIO(fetched)).size == (600, 400)

            await asyncio.to_thread(svc.rotate_image, paths["image_path"], "cw")
            rotated = await svc.read_image_bytes(paths["image_path"])
            assert Image.open(BytesIO(rotated)).size == (400, 600)

            svc.delete_images(
                {
                    "image_path": paths["image_path"],
                    "medium_path": paths["medium_path"],
                    "thumbnail_path": paths["thumbnail_path"],
                }
            )
            assert bucket_objects == {}

    @pytest.mark.asyncio
    async def test_tag_item_image_reads_from_supabase_when_not_on_local_disk(self):
        item_id = uuid4()
        user_id = uuid4()
        raw_bytes = _make_jpeg_bytes((200, 200))

        fake_item = MagicMock()
        fake_item.id = item_id
        fake_item.user_id = user_id
        fake_item.status = ItemStatus.processing
        fake_item.tagging_status = MagicMock()
        fake_item.tags = {}
        fake_item.type = "unknown"
        fake_item.subtype = None
        fake_item.primary_color = "unknown"

        mock_db = AsyncMock()
        res_item = MagicMock()
        res_item.scalar_one_or_none.return_value = fake_item
        res_locale = MagicMock()
        res_locale.scalar_one_or_none.return_value = "en"
        res_prefs = MagicMock()
        res_prefs.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(side_effect=[res_item, res_locale, res_prefs, res_item])

        fake_img_service = MagicMock()
        fake_img_service.backend = "supabase"
        fake_img_service.read_image_bytes = AsyncMock(return_value=raw_bytes)

        fake_ai = MagicMock()
        fake_ai._endpoints = [MagicMock()]
        fake_ai.analyze_image = AsyncMock(
            return_value=AIService()._parse_tags_from_response(
                '{"type": "jacket", "primary_color": "navy", "colors": ["navy"]}'
            )
        )

        ctx = {"db_session_factory": lambda: mock_db, "job_try": 3}
        with (
            patch("app.workers.tagging.ImageService", return_value=fake_img_service),
            patch("app.workers.tagging.AIService", return_value=fake_ai),
        ):
            out = await tag_item_image(ctx, str(item_id), f"{user_id}/nonexistent_local.jpg")

        assert out["status"] == "success"
        fake_img_service.read_image_bytes.assert_awaited_once_with(
            f"{user_id}/nonexistent_local.jpg"
        )
        fake_ai.analyze_image.assert_awaited_once_with(raw_bytes, locale="en")
