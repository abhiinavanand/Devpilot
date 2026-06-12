-- Core tables
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  organization_id INT REFERENCES organizations(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
