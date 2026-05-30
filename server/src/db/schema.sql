-- ============================================================
-- A2 · PostgreSQL 数据库模式 · Database Schema
-- ============================================================
--
-- 4 张表：玩家、好友关系、好友请求、聊天消息。
-- 4 tables: players, friendships, friend_requests, chat_messages.
--
-- 在 PostgreSQL 中运行：
-- Run in PostgreSQL:
--   psql -U szu_valley -d szu_valley -f schema.sql

-- 玩家表 · Players table
CREATE TABLE IF NOT EXISTS players (
    id          UUID PRIMARY KEY,
    name        VARCHAR(12) NOT NULL,
    avatar      VARCHAR(20) NOT NULL DEFAULT 'avatar_01',
    tags        TEXT[] NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE players IS '玩家公开资料 · Player public profiles';
COMMENT ON COLUMN players.tags IS '自定义标签 e.g. {前端,找项目队友,23级计软}';

-- 好友关系表（双向，CHECK 保证 a < b 避免重复）
-- Friendships table (bidirectional, CHECK a < b prevents duplicates)
CREATE TABLE IF NOT EXISTS friendships (
    player_a    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_b    UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player_a, player_b),
    CONSTRAINT chk_ordered CHECK (player_a < player_b)
);

COMMENT ON TABLE friendships IS '双向好友关系 · Bidirectional friendships';

-- 好友请求表（记录请求状态流转）
-- Friend requests table (tracks request state transitions)
CREATE TABLE IF NOT EXISTS friend_requests (
    id          UUID PRIMARY KEY,
    from_player UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    to_player   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status      VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE friend_requests IS '好友请求 · Friend requests';

-- 聊天消息表
-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id          SERIAL PRIMARY KEY,
    from_player UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    to_player   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    text        VARCHAR(500) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_messages IS '1:1 聊天消息 · 1:1 chat messages';

-- 索引 · Indexes
CREATE INDEX IF NOT EXISTS idx_chat_from_to_time
    ON chat_messages (from_player, to_player, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_conversation
    ON chat_messages (LEAST(from_player, to_player), GREATEST(from_player, to_player), created_at);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status
    ON friend_requests (to_player, status);

CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships (player_a);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships (player_b);
