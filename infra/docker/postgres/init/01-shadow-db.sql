-- Extra local databases for Prisma shadow/drift workflows (SP-005).
SELECT 'CREATE DATABASE sprachpilot_shadow OWNER sprachpilot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sprachpilot_shadow')\gexec
