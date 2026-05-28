-- Sprint 29 c1: aceitar transcripts de texto (export Notta) sem audio.
-- Tornar audio_path nullable e adicionar coluna `source` para distinguir
-- origem ('audio' default, 'notta-text', futuramente outras).

ALTER TABLE call_recordings ALTER COLUMN audio_path DROP NOT NULL;

ALTER TABLE call_recordings
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'audio';

ALTER TABLE call_recordings
  ADD COLUMN IF NOT EXISTS source_ref text;

COMMENT ON COLUMN call_recordings.source IS
  'Origem da gravacao: audio (default, telefone), notta-text (TXT exportado do Notta), etc.';
COMMENT ON COLUMN call_recordings.source_ref IS
  'Referencia opcional na origem (ex: nome do ficheiro Notta importado).';

CREATE INDEX IF NOT EXISTS idx_call_recordings_source ON call_recordings (organization_id, source);
