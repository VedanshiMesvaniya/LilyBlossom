-- Adds "rejected" to crawl_items.state so the admin review queue can
-- actually reject an item (crawler/worker.py's POST
-- /review/{id}/reject). The original constraint (005_crawler.sql) had
-- no state for "a human looked at this and said no."
alter table crawl_items drop constraint if exists crawl_items_state_check;
alter table crawl_items add constraint crawl_items_state_check
  check (state in ('new', 'existing', 'updated', 'duplicate', 'uncertain', 'error', 'rejected'));
