-- Explicit V1 cross-skill bridges prevent circular progression: customer work ->
-- Social -> Sales (Business), photography (Technology) -> skilled careers.
WITH config(code,xp_code,required_code,required_level,xp_reward) AS (VALUES
 ('CLEANER','FITNESS',NULL::text,NULL::integer,15),
 ('SHOP_ASSISTANT','SOCIAL',NULL,NULL,15),
 ('DELIVERY_RIDER','FITNESS','FITNESS',2,25),
 ('SALES_REP','BUSINESS','SOCIAL',2,25),
 ('PHOTOGRAPHER','TECHNOLOGY','SOCIAL',2,25),
 ('DESIGNER','TECHNOLOGY','TECHNOLOGY',2,25),
 ('JUNIOR_DEVELOPER','TECHNOLOGY','TECHNOLOGY',3,25),
 ('ACCOUNTANT','BUSINESS','BUSINESS',2,25),
 ('SOFTWARE_ENGINEER','TECHNOLOGY','TECHNOLOGY',5,35),
 ('MANAGER','BUSINESS','BUSINESS',4,35),
 ('CONSULTANT','BUSINESS','BUSINESS',6,40)
)
UPDATE jobs j SET xp_skill_id=x.id, xp_reward=c.xp_reward,
 required_skill_id=r.id, required_skill_lvl=c.required_level,
 future_requirement=CASE WHEN j.code='DELIVERY_RIDER' THEN 'Requires a vehicle · future progression' ELSE NULL END,
 updated_at=CURRENT_TIMESTAMP
FROM config c JOIN skills x ON x.code=c.xp_code LEFT JOIN skills r ON r.code=c.required_code
WHERE j.code=c.code AND j.xp_skill_id IS NULL;
