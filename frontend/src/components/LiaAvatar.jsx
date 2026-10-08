import React from 'react';
import original from '../assets/lia/lia-original.png';
import thoughtful from '../assets/lia/lia-thoughtful.png';
import pleased from '../assets/lia/lia-pleased.png';

export function liaMood(knowledge, thinking = false) {
  if (thinking || knowledge?.busy) return 'thinking';
  if (!knowledge?.review?.reviewed) return 'thoughtful';
  if (knowledge.review.score >= 85) return 'pleased';
  return knowledge.review.score >= 60 ? 'welcoming' : 'thoughtful';
}

export function LiaAvatar({ size = 40, knowledge, thinking = false }) {
  const mood = liaMood(knowledge, thinking);
  return <span className={`lia-avatar is-${mood}`} style={{ width: size, height: size }} aria-hidden="true">
    <img className="lia-avatar-base" src={mood === 'thoughtful' || mood === 'thinking' ? thoughtful : original} alt="" draggable="false" />
    {mood === 'pleased' && <img className="lia-avatar-blink" src={pleased} alt="" draggable="false" />}
  </span>;
}
