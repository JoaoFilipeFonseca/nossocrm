-- ============================================================================
-- Triggers de publish_event em contacts e deals
-- Sprint 0, commit 3 de 6.
--
-- Ficheiro separado da migration core para permitir revert isolado se um
-- destes triggers causar regressão no fluxo de criação de contactos ou
-- negócios. Cada função tem o seu próprio EXCEPTION handler além do que
-- já existe dentro de publish_event, defesa em profundidade.
--
-- Eventos publicados:
--   contacts INSERT  -> contact.created
--   contacts UPDATE  -> contact.updated, contact.stage.changed (se stage mudou)
--   contacts DELETE  -> contact.deleted
--   deals    INSERT  -> deal.created
--   deals    UPDATE  -> deal.updated, deal.stage.changed (se stage_id mudou),
--                       deal.won (se is_won passou a true),
--                       deal.lost (se is_lost passou a true)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- contacts
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_contacts_publish_events()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM publish_event('contact.created', row_to_json(NEW)::jsonb, NEW.organization_id, 'contacts_table');
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        PERFORM publish_event(
          'contact.stage.changed',
          jsonb_build_object('contact', row_to_json(NEW), 'old_stage', OLD.stage, 'new_stage', NEW.stage),
          NEW.organization_id,
          'contacts_table'
        );
      END IF;
      PERFORM publish_event('contact.updated', row_to_json(NEW)::jsonb, NEW.organization_id, 'contacts_table');
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM publish_event('contact.deleted', row_to_json(OLD)::jsonb, OLD.organization_id, 'contacts_table');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Defesa em profundidade: nunca quebrar a operação upstream em contacts.
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_publish_events ON contacts;
CREATE TRIGGER contacts_publish_events
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION trg_contacts_publish_events();

-- ----------------------------------------------------------------------------
-- deals
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_deals_publish_events()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM publish_event('deal.created', row_to_json(NEW)::jsonb, NEW.organization_id, 'deals_table');
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        PERFORM publish_event(
          'deal.stage.changed',
          jsonb_build_object('deal', row_to_json(NEW), 'old_stage_id', OLD.stage_id, 'new_stage_id', NEW.stage_id),
          NEW.organization_id,
          'deals_table'
        );
      END IF;
      PERFORM publish_event('deal.updated', row_to_json(NEW)::jsonb, NEW.organization_id, 'deals_table');
      IF COALESCE(OLD.is_won, false) = false AND COALESCE(NEW.is_won, false) = true THEN
        PERFORM publish_event('deal.won', row_to_json(NEW)::jsonb, NEW.organization_id, 'deals_table');
      END IF;
      IF COALESCE(OLD.is_lost, false) = false AND COALESCE(NEW.is_lost, false) = true THEN
        PERFORM publish_event('deal.lost', row_to_json(NEW)::jsonb, NEW.organization_id, 'deals_table');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_publish_events ON deals;
CREATE TRIGGER deals_publish_events
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION trg_deals_publish_events();
