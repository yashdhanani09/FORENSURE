# Forensic workflow

Forensic acquisition, hashing, recovery, evidence preservation, and reports are intentionally deferred past Phase 2. The current analysis includes mounted-filesystem capacity inventory and metadata-only folder browsing; it does not write to or open source USB files.

The planned workflow is: server-side selection → source validation → read-only analysis → metadata/hash work → capability-gated recovery tooling → immutable evidence directory → JSON/PDF report. Tool absence or unsupported filesystems will be reported explicitly, never represented as a successful recovery.
