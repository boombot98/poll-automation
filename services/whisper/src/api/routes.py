@app.post("/restart")
async def restart_service():
    """Restart the transcription engine."""
    try:
        # Get the transcription engine instance
        engine = get_transcription_engine()
        
        # Force reload the model
        engine.model = None
        engine._load_model()
        
        return {"status": "success", "message": "Transcription engine restarted"}
    except Exception as e:
        return {"status": "error", "message": f"Failed to restart: {str(e)}"}