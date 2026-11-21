import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';

// Timings and values are taken from the Figma 4.8s Splash timeline.
type Track = { times:number[]; values:number[]; easing:('inOut'|'out'|'linear')[] };
type Spec = { opacity:Track; y?:Track };
const specs:Record<string,Spec>={
  '346:7157':{opacity:{times:[0,37.5,66.667,100],values:[.5,.85,.58,.72],easing:['inOut','inOut','inOut']}},
  '346:7165':{opacity:{times:[0,37.5,66.667,100],values:[.4,.85,.5,.7],easing:['inOut','inOut','inOut']},y:{times:[0,37.5,66.667,100],values:[3,-4,2,0],easing:['inOut','inOut','inOut']}},
  '79:12':{opacity:{times:[0,11.458,100],values:[.65,1,1],easing:['out','linear']},y:{times:[0,11.458,100],values:[5,0,0],easing:['out','linear']}},
  '79:13':{opacity:{times:[0,1.667,14.583,100],values:[.65,.65,1,1],easing:['linear','out','linear']},y:{times:[0,1.667,14.583,100],values:[5,5,0,0],easing:['linear','out','linear']}},
  '79:14':{opacity:{times:[0,13.542,100],values:[.75,1,1],easing:['out','linear']},y:{times:[0,13.542,37.5,66.667,100],values:[8,0,-5,3,0],easing:['out','inOut','inOut','inOut']}},
};
type Motion = Record<string,{opacity:Animated.Value;y?:Animated.Value}>;
const MotionContext=createContext<Motion>({});
const ease={inOut:Easing.bezier(.42,0,.58,1),out:Easing.bezier(0,0,.58,1),linear:Easing.linear};
export function SplashMotion({active,children}:{active:boolean;children:React.ReactNode}){
  const [reduce,setReduce]=useState(true);
  const motion=useMemo(()=>Object.fromEntries(Object.entries(specs).map(([id,s])=>[id,{opacity:new Animated.Value(s.opacity.values[0]),y:s.y?new Animated.Value(s.y.values[0]):undefined}])) as Motion,[]);
  useEffect(()=>{void AccessibilityInfo.isReduceMotionEnabled().then(setReduce);const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce);return()=>sub.remove();},[]);
  useEffect(()=>{
    if(!active||reduce)return;
    const animations:Animated.CompositeAnimation[]=[];
    for(const [id,spec] of Object.entries(specs))for(const field of ['opacity','y'] as const){
      const track=spec[field],value=motion[id][field];if(!track||!value)continue;
      value.setValue(track.values[0]);
      animations.push(Animated.sequence(track.values.slice(1).map((toValue,i)=>Animated.timing(value,{toValue,duration:(track.times[i+1]-track.times[i])*48,easing:ease[track.easing[i]],useNativeDriver:Platform.OS!=='web',isInteraction:false}))));
    }
    const timeline=Animated.loop(Animated.parallel(animations),{iterations:-1,resetBeforeIteration:true});timeline.start();return()=>timeline.stop();
  },[active,reduce,motion]);
  return <MotionContext.Provider value={active&&!reduce?motion:{}}>{children}</MotionContext.Provider>;
}
export function useNodeMotion(id?:string){return useContext(MotionContext)[id||''];}
