import React from 'react';

import BoardSettings from '../../common/BoardSettings';

import FullBoard from './FullBoard';
import { ZoomDiv } from '../ZoomDiv';

interface IProps {
  station: string;
  editBoardCallback: () => void;
}

export default function DaktronicsDataDisplay({ station, editBoardCallback }: IProps) {
  let searchParams: URLSearchParams | null = null;
  if (typeof window !== 'undefined') {
    searchParams = window && new URLSearchParams(window.location.search);
  }

  const platforms = searchParams?.getAll('platform');

  return (
    <>
      <BoardSettings>{!!platforms?.length && <p>Only showing platform(s) {platforms.join(',')}</p>}</BoardSettings>{' '}
      <ZoomDiv>
        <div>
          <FullBoard
            station={station}
            platforms={platforms}
            useLegacyTocNames={!!searchParams?.get('useLegacyTocNames')}
            showUnconfirmedPlatforms={!!searchParams?.get('showUnconfirmedPlatforms')}
          />
        </div>
      </ZoomDiv>
    </>
  );
}
