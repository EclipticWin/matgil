import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth.jsx';
import SavedRoutesTab from '../features/courses/components/SavedRoutesTab.jsx';
import SavedPlacesTab from '../features/courses/components/SavedPlacesTab.jsx';
import PageShell from '../shared/components/PageShell.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import EmptyState from '../shared/components/EmptyState.jsx';
import Button from '../shared/components/Button.jsx';
import { RouteIcon } from '../shared/components/Icon.jsx';
import { useLocale } from '../shared/i18n/LocaleProvider.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import { cn } from '../shared/utils/classNames.js';

const TABS = [
  { key: 'routes', labelKey: 'courses.tabRoutes' },
  { key: 'places', labelKey: 'courses.tabPlaces' },
];

export default function CoursesPage() {
  const { t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('routes');

  return (
    <PageShell>
      <PageHeader
        title={t('savedCourses.title')}
        subtitle={t('savedCourses.subtitle')}
        subtitleClassName="mt-1"
      />

      {/* 비로그인 */}
      {!authLoading && !user && (
        <EmptyState
          className="mt-20"
          icon={<RouteIcon size={26} />}
          title={t('savedCourses.loginPrompt')}
          description={t('savedCourses.loginHint')}
          action={
            <Button onClick={() => navigate(ROUTES.login)}>
              {t('savedCourses.login')}
            </Button>
          }
        />
      )}

      {/* 로그인 상태 — 탭 + 각 탭 콘텐츠. 둘 다 항상 마운트해두고 숨김 처리만 바꿔서
          탭을 오갈 때마다 다시 조회하지 않는다(각 탭이 스스로 최초 1회만 로딩). */}
      {user && (
        <>
          <div className="mt-4 flex gap-1 border-b border-ink/8">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  'flex-1 border-b-2 py-2.5 text-center text-[0.85rem] font-bold transition-colors',
                  tab === item.key ? 'border-coral text-coral' : 'border-transparent text-ink-faint',
                )}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          <div className={tab === 'routes' ? 'mt-5' : 'hidden'}>
            <SavedRoutesTab />
          </div>
          <div className={tab === 'places' ? 'mt-5' : 'hidden'}>
            <SavedPlacesTab />
          </div>
        </>
      )}
    </PageShell>
  );
}
