import React, { memo } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { DesignNode, DesignScreen, LayoutStyle } from '../design/types';
import { assets } from '../design/assets';
import { DesignImage } from './DesignImage';
import { useNodeMotion } from './SplashMotion';
import motionAssetVariants from '../design/motion-assets.json';
import { DesignLabel } from './DesignLabel';
import { initialChoice } from '../design/sceneState';
import { colorContext, themeStyle, useTheme, type ColorContext } from '../design/theme';

export type SceneActions = {
  onPress: (node: DesignNode) => void;
  onDirectory: () => void;
  onField: (key: string, value: string) => void;
  onSubmit: (key: string) => void;
  text: (node: DesignNode, text: string) => string;
  choices: Record<string, boolean>;
  reminders: Record<string, boolean>;
  fields: Record<string, string>;
  scrollPositions: Record<string, number>;
  inputBindings: Record<string, { key: string; placeholder?: string; initial?: string; password?: boolean; numeric?: boolean }>;
  inputRoots: Record<string, boolean>;
  topInset: number;
  bottomInset: number;
};
const textKeys = ['fontFamily','fontWeight','fontSize','lineHeight','color','textAlign','letterSpacing'];
const fontNames: Record<string,string> = {400:'Manrope_400Regular',500:'Manrope_500Medium',600:'Manrope_600SemiBold',700:'Manrope_700Bold',800:'Manrope_800ExtraBold'};
const fieldLabels:Record<string,string>={email:'Email',password:'Mật khẩu',height:'Chiều cao',weight:'Cân nặng',bodyFat:'Tỷ lệ mỡ',chat:'Câu hỏi của bạn'};
function actionLabel(node:DesignNode,text:string){
  if(text.trim())return text;
  const name=node.name||'';
  if(name.includes('Context'))return 'Mở menu';
  if(name.includes('Write to'))return 'Viết câu hỏi';
  if(name.includes('EcoFit AI'))return 'Mở AI Coach';
  if(name.startsWith('Info /')){
    const term=/BMI/i.test(name)?'BMI':/TDEE/i.test(name)?'TDEE':/BMR/i.test(name)?'BMR':/Macro/i.test(name)?'dinh dưỡng đa lượng':/Body fat/i.test(name)?'tỷ lệ mỡ':'mục tiêu năng lượng';
    return 'Giải thích '+term;
  }
  return name==='Frame'||/Back/i.test(name)?'Quay lại':'Mở chi tiết';
}
export function fontStyle(style: LayoutStyle) {
  const {fontWeight,fontFamily,...rest}=style;
  return {...rest,fontFamily:fontFamily==='Inter'?'Inter_400Regular':fontNames[fontWeight||500]||'Manrope_500Medium'};
}
function readText(node: DesignNode): string {return node.children.map(c=>typeof c==='string'?c:readText(c)).join(' ');}
function gradientParts(value: string, width:number,height:number) {
  const colors=value.match(/#[0-9a-f]{6}|rgba?\([^)]+\)/gi)||['#145b46','#26765d'];
  const angle=+(value.match(/([\d.]+)deg/)?.[1]||140)*Math.PI/180;
  const x=Math.sin(angle),y=-Math.cos(angle),length=Math.abs(width*x)+Math.abs(height*y);
  const dx=x*length/Math.max(width,1)/2,dy=y*length/Math.max(height,1)/2;
  const locations=[...value.matchAll(/(?:#[0-9a-f]{6}|rgba?\([^)]+\))\s+([\d.]+)%/gi)].map(m=>+m[1]/100);
  return {colors:colors as [string,string,...string[]],locations:locations.length===colors.length?locations as [number,number,...number[]]:undefined,start:{x:.5-dx,y:.5-dy},end:{x:.5+dx,y:.5+dy}};
}
function DesignGradient({value,radius}:{value:string;radius?:number}){
  const [size,setSize]=React.useState({width:350,height:180});
  return <LinearGradient pointerEvents="none" {...gradientParts(value,size.width,size.height)} onLayout={e=>{
    const {width,height}=e.nativeEvent.layout;setSize(old=>old.width===width&&old.height===height?old:{width,height});
  }} style={{position:'absolute',inset:0,borderRadius:radius}}/>;
}
function NativeNode({node,actions,inherited={},selected,parentContext='normal',assetIcon=false}: {node:DesignNode; actions:SceneActions; inherited?:LayoutStyle; selected?:boolean; parentContext?:ColorContext; assetIcon?:boolean}) {
  const {isDark,colors}=useTheme();
  const context=colorContext(node,parentContext);
  const icon=assetIcon||/\bicon\b|^Radio$/i.test(node.name||'');
  const own=themeStyle(node.style||{},isDark,context);
  const motion=useNodeMotion(node.id);
  const splashAnimating=Boolean(useNodeMotion('79:14'));
  const movingStyle=motion?{opacity:motion.opacity,transform:[...(own.transform||[]),...(motion.y?[{translateY:motion.y}]:[])]}:undefined;
  const typeStyle={...inherited};
  for(const k of textKeys)if(own[k]!==undefined)typeStyle[k]=own[k];
  const style={...own};for(const k of textKeys)delete style[k];
  const text=readText(node);
  if(Platform.OS!=='web'){
    if(node.name==='V4 / System / Home indicator')return null;
    if(node.tag==='p'&&(text==='9:41'||/●\s+◢/.test(text)))return null;
    if(node.name==='Layout / responsive shell'){
      style.top=Math.max(48,actions.topInset+4);style.bottom=Math.max(34,actions.bottomInset);
    }
  }
  if(node.tag==='img') {
    const variants=motionAssetVariants as Record<string,string>;
    const key=node.asset&&(splashAnimating?variants[node.asset]||node.asset:node.asset);
    const asset=key&&assets[key];
    return asset?<DesignImage testID={'asset-'+key} asset={asset} style={style} fit={node.fit} colorContext={context} icon={icon}/>:null;
  }
  const input=node.id&&actions.inputBindings[node.id];
  if(node.tag==='p'){
    const s=fontStyle({...style,...typeStyle,includeFontPadding:false});
    if(input){
      const unit = input.key === 'height' ? 'cm' : input.key === 'weight' ? 'kg' : null;
      const inputValue = actions.fields[input.key] ?? input.initial ?? '';
      const numericValue = unit ? inputValue.replace(/[^0-9.,]/g, '') : inputValue;
      // The unit is a separate label: the numeric keyboard can never remove it.
      const field = <TextInput testID={'input-'+input.key} accessibilityLabel={fieldLabels[input.key]||'Nhập giá trị'}
        value={numericValue} placeholder={unit ? (unit === 'cm' ? '178' : '76') : input.placeholder}
        placeholderTextColor={typeStyle.color||colors.muted} secureTextEntry={input.password} keyboardAppearance={isDark?'dark':'light'} selectionColor={colors.accent}
        autoCapitalize="none" autoCorrect={false} keyboardType={input.numeric?'decimal-pad':input.key==='email'?'email-address':'default'}
        returnKeyType={input.key==='chat'?'send':'done'}
        onChangeText={v=>actions.onField(input.key,unit ? v.replace(/[^0-9.,]/g,'') : v)}
        onSubmitEditing={()=>actions.onSubmit(input.key)}
        style={[s,{padding:0,margin:0,minHeight:own.lineHeight||20,borderWidth:0,outlineWidth:0},unit?{width:undefined,flexGrow:0,flexShrink:1,minWidth:48}:{}] as any}/>;
      if(!unit)return field;
      return <View style={{flexDirection:'row',alignItems:'baseline',width:'100%',minHeight:own.lineHeight||20}}>
        {field}
        <Text accessibilityLabel={'Đơn vị '+unit} style={[s,{width:undefined,marginLeft:3,flexShrink:0}]}>{unit}</Text>
      </View>;
    }
    const content=actions.text(node,node.children.filter(c=>typeof c==='string').join(''));
    const onLongPress=(own.fontSize||0)>=20||/EcoFit|^Eco$|^Fit\.$/.test(content)?actions.onDirectory:undefined;
    return <DesignLabel animated={Boolean(motion)} testID={node.id} style={motion?[s,movingStyle]:s} onLongPress={onLongPress}>{content}</DesignLabel>;
  }
  const changed=node.id?actions.choices[node.id]:undefined;
  const isChoice=node.name?.startsWith('Choose');
  const choiceSelected=changed??initialChoice(node);
  const active=selected||choiceSelected;
  if(isChoice&&changed!==undefined){style.backgroundColor=changed?colors.secondary:colors.surface;}
  const appearance=node.id==='202:3787'||node.id==='202:3790';
  if(appearance&&changed){style.borderColor=colors.accent;style.borderWidth=1.5;}
  if(node.name==='Radio'&&active)return <View style={[style,{borderWidth:1.5,borderColor:colors.accent,borderRadius:20,alignItems:'center',justifyContent:'center'}]}><View style={{width:10,height:10,borderRadius:5,backgroundColor:colors.accent}}/></View>;
  if(node.name?.startsWith('Reminder switch')&&node.id&&actions.reminders[node.id]!==undefined){
    const on=actions.reminders[node.id];
    return <Pressable testID={node.id} accessibilityRole="switch" accessibilityState={{checked:on}} aria-checked={on} accessibilityLabel={text} onPress={()=>actions.onPress(node)} style={style}>
      <NativeNode node={node.children[0] as DesignNode} inherited={typeStyle} actions={actions} parentContext={context}/>
      <View style={{width:50,height:30,borderRadius:15,backgroundColor:on?colors.primary:colors.border,padding:3,alignItems:on?'flex-end':'flex-start'}}><View style={{width:24,height:24,borderRadius:12,backgroundColor:on?colors.onAccent:'#ffffff'}}/></View>
    </Pressable>;
  }
  // Reuse the exported check icon for every day. Static checks in the source
  // frame describe its initial state; they must follow the current selection.
  const isDay=node.name?.startsWith('Choose day /');
  const childNodes=isDay?node.children.filter(child=>typeof child==='string'||child.name!=='V4 / Icon / check'):node.children;
  const children=childNodes.map((child,i)=>typeof child==='string'?<Text key={i} style={fontStyle(typeStyle)}>{child}</Text>:<NativeNode key={child.id||i} node={child} inherited={typeStyle} actions={actions} selected={isChoice?choiceSelected:active} parentContext={context} assetIcon={icon}/>);
  if(isDay&&choiceSelected)children.push(<DesignImage key="day-check" testID={'check-'+node.id} asset={assets['8edf14315bdfbf9d92bc']} style={{position:'relative',flexShrink:0,width:20,height:20}} icon/>);
  const gradient=node.gradient&&<DesignGradient value={node.gradient} radius={style.borderRadius}/>;
  if(node.scroll){
    const {alignItems,justifyContent,flexDirection,gap,...outer}=style;
    return <ScrollView testID={node.id} style={outer} contentContainerStyle={{alignItems,justifyContent,flexDirection,gap}} showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled" scrollEventThrottle={100} contentOffset={{x:0,y:actions.scrollPositions[node.id||'']||0}}
      onScroll={e=>{if(node.id)actions.scrollPositions[node.id]=e.nativeEvent.contentOffset.y;}}>
      {children}
    </ScrollView>;
  }
  const editableCard = ['148:3548','148:3551','202:4002'].includes(node.id||'');
  const interactive=(editableCard||node.tag==='a'||node.tag==='button'||node.name?.startsWith('Info /'))&&!actions.inputRoots[node.id||''];
  const reminder=node.name?.startsWith('Reminder switch');
  if(interactive)return <Pressable testID={node.id} accessibilityLabel={actionLabel(node,text)}
    accessibilityRole={reminder?'switch':isChoice?'checkbox':node.name?.startsWith('Tab /')?'tab':'button'}
    aria-checked={reminder?(actions.reminders[node.id||'']??true):isChoice?active:undefined}
    accessibilityState={reminder?{checked:actions.reminders[node.id||'']??true}:isChoice?{checked:active}:appearance?{selected:Boolean(changed)}:undefined} onPress={()=>actions.onPress(node)} onLongPress={node.name==='Frame'&&!text?actions.onDirectory:undefined}
    style={({pressed})=>[style,pressed&&{opacity:.78}]}>
    {gradient}{children}
  </Pressable>;
  if(motion)return <View style={style}><Animated.View testID={node.id} style={{width:'100%',height:'100%',opacity:motion.opacity,transform:motion.y?[{translateY:motion.y}]:[]}}>{gradient}{children}</Animated.View></View>;
  return <View testID={node.id} style={style}>{gradient}{children}</View>;
}
export const NativeScene=memo(function NativeScene({screen,actions}:{screen:DesignScreen;actions:SceneActions}){
  return <NativeNode node={screen.tree} actions={actions}/>;
});
