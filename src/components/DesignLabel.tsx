import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Text } from 'react-native';

export function DesignLabel({children,style,testID,onLongPress,animated=false}:{
  children:string;style:any;testID?:string;onLongPress?:()=>void;animated?:boolean;
}){
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const held=useRef(false);
  const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
  useEffect(()=>cancel,[]);
  const start=()=>{cancel();held.current=false;timer.current=setTimeout(()=>{held.current=true;onLongPress?.();},600);};
  // RN Web Text does not implement onLongPress; leave ordinary click/scroll events bubbling.
  const web:any=Platform.OS==='web'&&onLongPress?{
    onMouseDown:start,onMouseUp:cancel,onMouseLeave:cancel,
    onTouchStart:start,onTouchEnd:cancel,onTouchCancel:cancel,onTouchMove:cancel,
    onClick:(e:any)=>{if(held.current){e.stopPropagation();e.preventDefault();held.current=false;}},
  }:{};
  const nativeHold=Platform.OS==='web'?undefined:onLongPress;
  if(animated)return <Animated.Text testID={testID} selectable={false} style={style} onLongPress={nativeHold} {...web}>{children}</Animated.Text>;
  return <Text testID={testID} selectable={false} style={style} onLongPress={nativeHold} {...web}>{children}</Text>;
}
