import React, { memo } from 'react';
import { Image, LayoutChangeEvent, Platform, View } from 'react-native';
import { SvgCss } from 'react-native-svg/css';
import { Asset } from 'expo-asset';
import type { DesignAsset, LayoutStyle } from '../design/types';
import { loadSvg } from '../design/loadSvg';
import { themeSvg, useTheme, type ColorContext } from '../design/theme';

// Preserve the exported SVG root dimensions. Scale its container to the design slot.
export const DesignImage = memo(function DesignImage({ asset, style, fit='fill', testID, colorContext='normal', icon=false }: {
  asset: DesignAsset; style: LayoutStyle; fit?: 'fill' | 'cover' | 'contain'; testID?: string; colorContext?: ColorContext; icon?: boolean;
}) {
  const {isDark}=useTheme();
  const [size,setSize]=React.useState({width:0,height:0});
  const [xml,setXml]=React.useState<string|null>(null);
  React.useEffect(()=>{
    if(asset.kind!=='svg'||(Platform.OS==='web'&&!isDark))return;
    let active=true;
    setXml(null);
    void loadSvg(asset.source).then(value=>{if(active)setXml(value);}).catch(error=>{if(active)console.error(error);});
    return()=>{active=false;};
  },[asset.kind,asset.source,isDark]);
  const themedXml=React.useMemo(()=>xml?themeSvg(xml,isDark,colorContext,icon):null,[xml,isDark,colorContext,icon]);
  if(asset.kind!=='svg')return <Image testID={testID} source={asset.source} style={style} resizeMode={fit==='fill'?'stretch':fit} accessibilityIgnoresInvertColors />;
  // Let the browser display the original SVG, including its gradients, masks
  // and filters. Its intrinsic root dimensions stay unchanged in the file.
  if(Platform.OS==='web')return <Image testID={testID} source={{uri:isDark?(themedXml?'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(themedXml):undefined):Asset.fromModule(asset.source).uri}} style={style} resizeMode={fit==='fill'?'stretch':fit} pointerEvents="none" accessibilityIgnoresInvertColors />;
  const w=asset.width||24,h=asset.height||24;
  const onLayout=(e:LayoutChangeEvent)=>{
    const {width,height}=e.nativeEvent.layout;
    setSize(old=>old.width===width&&old.height===height?old:{width,height});
  };
  const sx=size.width/w,sy=size.height/h;
  return <View testID={testID} pointerEvents="none" style={style} onLayout={onLayout}>
    {size.width>0&&size.height>0&&themedXml&&<View style={{position:'absolute',left:(size.width-w)/2,top:(size.height-h)/2,width:w,height:h,transform:[{scaleX:sx},{scaleY:sy}]}}>
      <SvgCss xml={themedXml} />
    </View>}
  </View>;
});
