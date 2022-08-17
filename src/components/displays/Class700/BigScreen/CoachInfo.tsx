import React from 'react';
import { getUrlParam } from '../getUrlParam';

import EndCoach from '../assets/endcoach.inline.svg';
import Coach from '../assets/coach.inline.svg';

export default function CoachInfoBigScreen() {
  let coach = getUrlParam('coach') ?? 1;
  let coaches = getUrlParam('coaches') ?? 12;

  return (
    <div className="coachInfo splitLines splitLines--offset">
      <div className="darkBlue">
        <div className="layout-title">
          <span className="text coach-intro">This is coach</span>
          <span className="text t900 coach-num">{coach}</span>
          <span className="text coach-of">of</span>
          <span className="text t900 coach-total">{coaches}</span>
        </div>
      </div>
      <div className="lightBlue">
        <div className="coach-diagram" style={{ '--coach-count': coaches, '--coach': coach }}>
          <span className="front-label text t900">◀ FRONT</span>

          {Array.from({ length: coaches }, (_, i) => i + 1).map((coachNum) => {
            console.log(coachNum);

            if (coachNum === 1) {
              return (
                <EndCoach style={{ '--coach': coachNum }} class="coach-svg" key={coachNum} height={25} data-active={coachNum.toString() === coach} />
              );
            } else {
              return (
                <Coach style={{ '--coach': coachNum }} class="coach-svg" key={coachNum} height={25} data-active={coachNum.toString() === coach} />
              );
            }
          })}

          <div className="current-label ">
            <span>▲</span>
            <span className="text t900 coach-here">YOU ARE HERE</span>
            <span className="text coach-num-small">in coach {coach}</span>
          </div>

          {Array.from({ length: coaches }, (_, i) => (
            <span className="text t900 coach-diagram-num" style={{ '--coach': i + 1 }} data-active={(i + 1).toString() === coach}>
              {i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
