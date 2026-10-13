# Save a personal quiz

The API validates direct quiz content with question IDs. Creation inserts a private quiz;
editing locks its owned parent row and rejects public content. The backend compares validated
content/composition with the persisted record; equivalent saves return it without changes.

Substantive saves require no attempts of any status. Lock distinct source questions in UUID order,
verify each is public or owned private content, update title/description/settings, and replace ordered
composition in one transaction. SQL guards permanently lock each included question. A later failure
rolls back content, composition and newly established locks together. Concurrent attempt creation
locks the same parent, so either the complete save precedes its snapshot or the save receives 409.
