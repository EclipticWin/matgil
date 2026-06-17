import { COURSES } from '../features/courses/data/courses.js';
import CourseCard from '../features/courses/components/CourseCard.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';

export default function CoursesPage() {
  return (
    <PageShell>
      <PageHeader
        title="Food courses"
        subtitle="Hand-picked eating routes across Seoul"
        subtitleClassName="mt-1"
      />

      <div className="mt-5 flex flex-col gap-4">
        {COURSES.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </PageShell>
  );
}
