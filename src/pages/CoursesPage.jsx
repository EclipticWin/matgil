import { COURSES } from '../features/courses/data/courses.js';
import CourseCard from '../features/courses/components/CourseCard.jsx';

/** Courses tab (동선코스): hand-picked eating routes across Seoul. */
export default function CoursesPage() {
  return (
    <div className="px-5 pb-6 pt-6">
      <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-ink">Food courses</h1>
      <p className="mt-1 text-sm text-ink-soft">Hand-picked eating routes across Seoul</p>

      <div className="mt-5 flex flex-col gap-4">
        {COURSES.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
