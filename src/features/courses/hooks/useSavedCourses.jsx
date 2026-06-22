import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/hooks/useAuth.jsx';
import { fetchSavedCourses, softDeleteSavedCourse } from '../services/savedCourseService.js';

export function useSavedCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSavedCourses({ userId: user.id });
      setCourses(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback(
    async (courseId) => {
      if (!user) return;
      await softDeleteSavedCourse({ userId: user.id, courseId });
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    },
    [user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { courses, loading, error, remove, reload: load };
}
