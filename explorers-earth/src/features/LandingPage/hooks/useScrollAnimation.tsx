import { useEffect, useRef, useState } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce && ref.current) {
            observer.unobserve(ref.current);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, isVisible };
}

export function useStaggeredAnimation(itemCount: number, delay: number = 100) {
  const [visibleItems, setVisibleItems] = useState(0);
  const { ref, isVisible } = useScrollAnimation();

  useEffect(() => {
    if (isVisible) {
      const timer = setInterval(() => {
        setVisibleItems(prev => {
          if (prev >= itemCount) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, delay);

      return () => clearInterval(timer);
    }
  }, [isVisible, itemCount, delay]);

  return { ref, visibleItems };
}