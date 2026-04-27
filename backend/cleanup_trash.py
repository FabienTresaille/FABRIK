import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Client, Audit

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("cleanup_trash")

def cleanup():
    """Supprime définitivement les éléments de la corbeille vieux de plus de 30 jours."""
    db: Session = SessionLocal()
    try:
        threshold = datetime.now(timezone.utc) - timedelta(days=30)
        
        # Hard delete clients (which cascades to audits due to ON DELETE CASCADE)
        old_clients = db.query(Client).filter(Client.deleted_at != None, Client.deleted_at < threshold).all()
        for c in old_clients:
            db.delete(c)
            logger.info(f"Purge: Client #{c.id} ({c.company_name}) supprimé définitivement.")
            
        # Hard delete standalone audits (if any were deleted individually)
        old_audits = db.query(Audit).filter(Audit.deleted_at != None, Audit.deleted_at < threshold).all()
        for a in old_audits:
            db.delete(a)
            logger.info(f"Purge: Audit #{a.id} supprimé définitivement.")
            
        db.commit()
        logger.info("Nettoyage de la corbeille terminé avec succès.")
    except Exception as e:
        logger.error(f"Erreur lors du nettoyage de la corbeille : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
