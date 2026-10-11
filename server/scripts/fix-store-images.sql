UPDATE StoreProduct SET images = '[]' WHERE images IS NULL OR images = '' OR images = 'null';
UPDATE StoreProduct SET images = json_array(imageUrl) WHERE imageUrl IS NOT NULL AND imageUrl != '' AND (images = '[]' OR images IS NULL);
