import BlackboxLandscapeLcd from '../../components/displays/WestMidsLCD';
import createBoardPage from '../../components/BoardPageTemplate';

export default createBoardPage(BlackboxLandscapeLcd, { requireStation: false });
