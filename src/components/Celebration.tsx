import React, { useEffect, useRef } from 'react';
import { runConfetti } from '../utils';

interface CelebrationProps {
  task: any;
  phrase: string;
  emoji: string;
  pts: number;
  lang: string;
  onClose: () => void;
}

export const Celebration: React.FC<CelebrationProps> = ({
  phrase,
  emoji,
  pts,
  lang,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancel: (() => void) | undefined;
    if (canvasRef.current) {
      cancel = runConfetti(canvasRef.current, 3000);
    }
    const timer = setTimeout(() => {
      onClose();
    }, 4500);

    return () => {
      if (cancel) cancel();
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className="celebration-layer" onClick={onClose}>
      <canvas ref={canvasRef} className="confetti-canvas" />
      <div className="celebration-card" onClick={(e) => e.stopPropagation()}>
        <div className="celebration-emoji">{emoji}</div>
        <h2 className="celebration-title">
          {lang === 'zh' ? '任务达成！' : 'Quest Accomplished!'}
        </h2>
        <div className="celebration-phrase">{phrase}</div>
        <div className="celebration-reward-pill">
          +{pts} {emoji}
        </div>
        <button className="celebration-btn" onClick={onClose}>
          {lang === 'zh' ? '太棒啦！' : 'Awesome!'}
        </button>
      </div>
    </div>
  );
};
