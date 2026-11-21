import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppearancePreference } from '../design/theme';

export type DemoData = {
  version: 1;
  appearance: AppearancePreference;
  fields: Record<string, string>;
  choices: Record<string, boolean>;
  waterMl: number | null;
  repetitions: number | null;
  savedMeal: boolean;
  mealLogged: boolean;
  setupComplete: boolean;
  reminders: Record<string, boolean>;
  chat: string;
};
const initial: DemoData = {
  version:1, appearance:'dark', fields:{}, choices:{}, waterMl:null, repetitions:null,
  savedMeal:false, mealLogged:false, setupComplete:false, reminders:{}, chat:'',
};
const key = 'ecofit.frontend-demo.v1';

function storedAppearance(value: Partial<DemoData>): AppearancePreference {
  if (value.appearance === 'light' || value.appearance === 'dark') {
    return value.appearance;
  }
  // Keep a choice made before appearance had its own persisted setting.
  const legacy = value.fields?.['setting:202:3784'];
  if (legacy === 'Sáng') return 'light';
  if (legacy === 'Tối') return 'dark';
  return initial.appearance;
}
type Store = {
  data: DemoData;
  loaded: boolean;
  patch: (values: Partial<DemoData>) => void;
  setField: (key: string, value: string) => void;
  setChoice: (id: string, value: boolean, clearIds?: string[]) => void;
  reset: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [data,setData]=useState<DemoData>(initial);
  const [loaded,setLoaded]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>{
    let mounted=true;
    AsyncStorage.getItem(key).then(raw=>{
      if(!mounted)return;
      if(raw){try{const value=JSON.parse(raw);if(value?.version===1){const fields={...value.fields};delete fields.password;delete fields.otp;setData({...initial,...value,appearance:storedAppearance(value),fields});}}catch{}}
    }).catch(()=>{}).finally(()=>{if(mounted)setLoaded(true);});
    return()=>{mounted=false;};
  },[]);
  useEffect(()=>{
    if(!loaded)return;
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{
      const fields={...data.fields};delete fields.password;delete fields.otp;
      void AsyncStorage.setItem(key,JSON.stringify({...data,fields})).catch(()=>{});
    },200);
    return()=>{if(timer.current)clearTimeout(timer.current);};
  },[data,loaded]);
  const store: Store = {
    data, loaded,
    patch:values=>setData(prev=>({...prev,...values})),
    setField:(field,value)=>setData(prev=>({...prev,fields:{...prev.fields,[field]:value}})),
    setChoice:(id,value,clearIds=[])=>setData(prev=>{
      const choices={...prev.choices};for(const clear of clearIds)choices[clear]=false;
      choices[id]=value;return {...prev,choices};
    }),
    reset:async()=>{await AsyncStorage.removeItem(key);setData(initial);},
  };
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useDemo(){const value=useContext(Context);if(!value)throw new Error('DemoProvider missing');return value;}
