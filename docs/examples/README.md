# Import examples

## Courses and lessons

- [Example course with lessons](sample-course.json): creates **Learning with curiosity**, with two
  ordered lessons containing educational text and basic Markdown. Open **Courses → Import course**
  and select this file.
- [Example lessons](sample-lessons.json): appends a lesson to an existing course. Open a course,
  choose **Import lessons**, and select this file.

Both import screens offer the corresponding example download beside the file picker, following the
quiz import pattern. Select the downloaded JSON to review its content before importing. Imported
courses and lessons are public; importing requires sign-in. These examples contain no quizzes.

A course file has `title`, optional `description`, and a `lessons` array. An append file has only the
`lessons` array. Each lesson has `title`, optional `description`, and `content`. Array order determines
lesson order. Use `\n` within JSON strings for line breaks in plain text or Markdown content.

The downloadable copies are [sample-course.json](../../frontend/public/sample-course.json) and
[sample-lessons.json](../../frontend/public/sample-lessons.json). Keep each pair identical when
updating the examples.

## Question batches

The other JSON files in this directory demonstrate question batch imports across different topics.
See [the backend batch import documentation](../../backend/README.md#private-batch-import) for the
batch format and import workflow.
