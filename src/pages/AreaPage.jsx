import { useNavigate } from 'react-router-dom';
import { useRecommendation } from '../features/recommendation/hooks/useRecommendation.jsx';
import AreaSelector from '../features/area/components/AreaSelector.jsx';
import { ROUTES } from '../shared/constants/routes.js';
import Header from '../shared/components/Header.jsx';
import StepIndicator from '../shared/components/StepIndicator.jsx';
import Button from '../shared/components/Button.jsx';

/** Step 1 of the recommendation flow: choose a neighbourhood. */
export default function AreaPage() {
  const navigate = useNavigate();
  const { area, setArea } = useRecommendation();

  return (
    <div className="flex h-full flex-col bg-paper">
      <Header title="Where are you headed?" onBack={() => navigate(ROUTES.home)} />
      <div className="px-5">
        <StepIndicator step={1} total={2} />
      </div>

      <div className="no-scrollbar mt-4 flex-1 overflow-y-auto px-5 pb-4">
        <AreaSelector value={area?.id} onChange={setArea} />
      </div>

      <div className="border-t border-ink/5 px-5 pb-8 pt-3">
        <Button full disabled={!area} onClick={() => navigate(ROUTES.preference)}>
          Next
        </Button>
      </div>
    </div>
  );
}
