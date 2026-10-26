# Supabase PostgreSQL Pooler & asyncpg Configuration

Supabase provides two connection modes:
1. **Direct Connection (Port 5432)**: Direct session connection to PostgreSQL.
2. **Transaction Pooler (Port 6543)**: Supavisor / PgBouncer pooler for high concurrency and serverless architectures.

---

## 1. Cluster Identification (`aws-1` vs `aws-0`)

Supabase projects are provisioned across regional clusters (e.g. `aws-0`, `aws-1`, `aws-2`).

### The Bug: `tenant or user not found`
If your project is on cluster `aws-1`, connecting to:
`postgres.<ref>:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`
will fail with:
```
FATAL: tenant or user not found
```

### Discovery Command
Always test your connection directly using `asyncpg` or `psql` to verify the active cluster:
```python
import asyncio
import asyncpg

async def check():
    for cluster in ["aws-0", "aws-1", "aws-2"]:
        host = f"{cluster}-eu-central-1.pooler.supabase.com"
        try:
            conn = await asyncpg.connect(
                user="postgres.<project-ref>",
                password="<password>",
                database="postgres",
                host=host,
                port=6543,
                timeout=5,
            )
            print(f"SUCCESS on {cluster}!")
            await conn.close()
            return host
        except Exception as e:
            print(f"Failed {cluster}: {e}")

asyncio.run(check())
```

---

## 2. Password Encoding in URLs

If your database password contains characters like `*`, `%`, `@`, `#`, or `/`, standard URL parsers will break.

Always URL-encode special characters in the connection string:
- `*` &rarr; `%2A`
- `@` &rarr; `%40`
- `%` &rarr; `%25`

**Example:**
Password `87T56R7u7**` becomes:
```
postgresql://postgres.ewcmihwbszizkshwqmnt:87T56R7u7%2A%2A@aws-1-eu-central-1.pooler.supabase.com:6543/postgres
```

---

## 3. SQLAlchemy & asyncpg Pooler Settings

Transaction poolers (PgBouncer/Supavisor) do NOT support prepared statements across different transactions because client connections are multiplexed over shared backend connections.

### Mandatory Flags for Port 6543
1. **Disable Prepared Statement Caching**: `statement_cache_size=0`
2. **Use NullPool in Serverless**: Serverless functions (e.g. Vercel) terminate quickly; maintaining a connection pool leads to exhausted pool limits. Use `NullPool`.
3. **Strip Incompatible Libpq Query Params**: `pgbouncer=true`, `channel_binding`, etc. must be stripped before passing to `asyncpg`.

```python
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

def get_engine(url_str: str, is_serverless: bool = True):
    url = make_url(url_str)
    connect_args = {}

    # Required for transaction poolers
    if url.port == 6543 or "pooler.supabase.com" in (url.host or ""):
        connect_args["statement_cache_size"] = 0

    engine_kwargs = {
        "connect_args": connect_args,
        "poolclass": NullPool if is_serverless else None,
    }

    return create_async_engine(url, **engine_kwargs)
```
