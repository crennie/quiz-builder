# Create and edit questions

A verified user posts validated `QuestionContent` to create a private direct record. Owner/public
reads return flattened content with derived `canEditContent`. Owner edits lock the question and
require private visibility. Before use, substantive content changes update the row transactionally.
Equivalent saves leave it untouched. First inclusion in any quiz permanently sets `content_locked_at`;
a later substantive edit returns 409 even after removal. Create an independent record for changes.
Tags remain mutable under entity/tag ownership checks. Ordinary public editing/promotion is absent.
