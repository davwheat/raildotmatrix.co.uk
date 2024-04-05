import DaktronicsDataDisplayDmi from '../../components/displays/DaktronicsDataDisplayDmi';
import createBoardPage from '../../components/BoardPageTemplate';

export default createBoardPage(DaktronicsDataDisplayDmi, { requireStation: true });
