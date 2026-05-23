CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS superusers (
    username TEXT PRIMARY KEY,
    passwordHash TEXT NOT NULL,
    salt TEXT NOT NULL,
    createdAt INTEGER NOT NULL
);

INSERT OR IGNORE INTO superusers (username, passwordHash, salt, createdAt) VALUES ('admin', '77e48ff69119cbf8f46d0143687220fbafcb4f28b8ce7cd6506b441b1c7bbebd', 'salt_12345', 1779206400000);

CREATE TABLE IF NOT EXISTS link_clicks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    ip TEXT,
    userAgent TEXT,
    country TEXT,
    referer TEXT,
    clickedAt INTEGER NOT NULL
);

