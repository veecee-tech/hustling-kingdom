INSERT INTO jobs(id,code,name,description,location_label,base_reward,energy_cost,cooldown_seconds,future_requirement,sort_order,updated_at) VALUES
('44000000-0000-4000-8000-000000000001','CLEANER','Cleaner','Freshen up the neighbourhood. Reliable work, paid per shift.','Old Town Cleaning Services','8000','10','30',NULL,'1',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000002','SHOP_ASSISTANT','Shop Assistant','Help customers and keep the shelves stocked.','Corner Mart · Old Town','10000','12','45',NULL,'2',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000003','DELIVERY_RIDER','Delivery Rider','Keep deliveries moving across Kingdom City.','Kingdom Express','15000','15','60','Requires a vehicle · future progression','3',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000004','SALES_REP','Sales Rep','Help local businesses find their customers.','Mainland Sales Co.','20000','15','60','Requires Social skill · future progression','4',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000005','PHOTOGRAPHER','Photographer','Capture the city at its best.','City Centre Studio','35000','15','60','Requires creative skill progression','5',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000006','DESIGNER','Designer','Bring a client brief to life.','Kingdom Creative','45000','15','60','Requires Technology skill · future progression','6',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000007','JUNIOR_DEVELOPER','Junior Developer','Build tools for a growing city.','Kingdom Tech Hub','60000','15','60','Requires Technology skill · future progression','7',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000008','ACCOUNTANT','Accountant','Help a business keep its books in order.','City Centre Accounts','65000','15','60','Requires Business skill · future progression','8',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000009','SOFTWARE_ENGINEER','Software Engineer','Create dependable city software.','Kingdom Tech Hub','120000','20','90','Requires advanced Technology progression','9',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000010','MANAGER','Manager','Lead a team through its next challenge.','Kingdom Offices','180000','20','90','Requires advanced Business progression','10',CURRENT_TIMESTAMP),
('44000000-0000-4000-8000-000000000011','CONSULTANT','Consultant','Solve complex business problems.','Royal Advisory','300000','20','120','Requires advanced Business progression','11',CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;
