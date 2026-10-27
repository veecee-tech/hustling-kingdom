INSERT INTO skills(id,code,name,description,max_level,updated_at) VALUES
('55000000-0000-4000-8000-000000000001','BUSINESS','Business','Learn to organize work and build dependable enterprises.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000002','TECHNOLOGY','Technology','Turn creative tools and technical practice into capability.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000003','TRADING','Trading','Understand fictional markets. No active XP source yet.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000004','SOCIAL','Social','Get better at helping customers and communicating.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000005','FITNESS','Fitness','Build capability through physical work.',10,CURRENT_TIMESTAMP),
('55000000-0000-4000-8000-000000000006','STREET','Street','Know your way around Kingdom City. No active XP source yet.',10,CURRENT_TIMESTAMP)
ON CONFLICT(code) DO NOTHING;
