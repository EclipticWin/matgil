import { COURSES } from '../features/courses/data/courses.js';
import CourseCard from '../features/courses/components/CourseCard.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';

export default function CoursesPage() {
  const { t } = useLocale();
  return (
    <PageShell>
      <PageHeader
        title={t('courses.title')}
        subtitle={t('courses.subtitle')}
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
