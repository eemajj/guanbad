-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Charge_memberId_status_idx" ON "Charge"("memberId", "status");

-- CreateIndex
CREATE INDEX "MatchPlayer_memberId_idx" ON "MatchPlayer"("memberId");

-- Session.version goes up whenever the session or anything in it changes.
-- Done in the database so no code path can forget it. Phones poll this number
-- and reload only when it moves (see app/api/sessions/[id]/version).

-- Direct updates to a session row.
CREATE OR REPLACE FUNCTION guan_session_version_self() RETURNS trigger AS $$
BEGIN
  IF NEW.version = OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_version_self
BEFORE UPDATE ON "Session"
FOR EACH ROW EXECUTE FUNCTION guan_session_version_self();

-- Child rows that carry a sessionId: Court, Participant, Match, Charge.
CREATE OR REPLACE FUNCTION guan_session_version_child() RETURNS trigger AS $$
DECLARE
  sid text;
BEGIN
  sid := CASE WHEN TG_OP = 'DELETE' THEN OLD."sessionId" ELSE NEW."sessionId" END;
  UPDATE "Session" SET version = version + 1 WHERE id = sid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER court_bumps_session AFTER INSERT OR UPDATE OR DELETE ON "Court"
FOR EACH ROW EXECUTE FUNCTION guan_session_version_child();
CREATE TRIGGER participant_bumps_session AFTER INSERT OR UPDATE OR DELETE ON "Participant"
FOR EACH ROW EXECUTE FUNCTION guan_session_version_child();
CREATE TRIGGER match_bumps_session AFTER INSERT OR UPDATE OR DELETE ON "Match"
FOR EACH ROW EXECUTE FUNCTION guan_session_version_child();
CREATE TRIGGER charge_bumps_session AFTER INSERT OR UPDATE OR DELETE ON "Charge"
FOR EACH ROW EXECUTE FUNCTION guan_session_version_child();

-- MatchPlayer only knows its match (substitutions change players without touching Match).
CREATE OR REPLACE FUNCTION guan_session_version_match_player() RETURNS trigger AS $$
DECLARE
  mid text;
BEGIN
  mid := CASE WHEN TG_OP = 'DELETE' THEN OLD."matchId" ELSE NEW."matchId" END;
  UPDATE "Session" SET version = version + 1 WHERE id = (SELECT "sessionId" FROM "Match" WHERE id = mid);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_player_bumps_session AFTER INSERT OR UPDATE OR DELETE ON "MatchPlayer"
FOR EACH ROW EXECUTE FUNCTION guan_session_version_match_player();

-- Member names and levels show on every session they are in.
CREATE OR REPLACE FUNCTION guan_session_version_member() RETURNS trigger AS $$
BEGIN
  IF NEW.nickname IS DISTINCT FROM OLD.nickname OR NEW.level IS DISTINCT FROM OLD.level THEN
    UPDATE "Session" SET version = version + 1
    WHERE status <> 'CLOSED' AND id IN (SELECT "sessionId" FROM "Participant" WHERE "memberId" = NEW.id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_bumps_sessions AFTER UPDATE ON "Member"
FOR EACH ROW EXECUTE FUNCTION guan_session_version_member();
