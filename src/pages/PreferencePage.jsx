import { useNavigate } from 'react-router-dom';
import { useRecommendation } from '../features/recommendation/hooks/useRecommendation.jsx';
import PreferenceSelector from '../features/preference/components/PreferenceSelector.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Header from '../shared/components/Header.jsx';
import StepIndicator from '../shared/components/StepIndicator.jsx';
import Button from '../shared/components/Button.jsx';

/** Step 2 of the recommendation flow: pick taste & dietary preferences. */
export default function PreferencePage() {
  const navigate = useNavigate();
  const { prefs, setPrefs } = useRecommendation();

  return (
    <div className="flex h-full flex-col bg-paper">
      <Header title="What are you craving?" onBack={() => navigate(ROUTES.area)} />
      <div className="px-5">
        <StepIndicator step={2} total={2} />
      </div>

      <div className="no-scrollbar mt-5 flex-1 overflow-y-auto px-5 pb-4">
        <PreferenceSelector value={prefs} onChange={setPrefs} />
      </div>

      <div className="border-t border-ink/5 px-5 pb-8 pt-3">
        <Button full onClick={() => navigate(ROUTES.loading)}>
          See recommendations
        </Button>
      </div>
    </div>
  );
}
