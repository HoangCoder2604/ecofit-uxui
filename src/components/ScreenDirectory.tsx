import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DesignScreen } from '../design/types';
import { useTheme } from '../design/theme';
const font='Manrope_500Medium';
export function ScreenDirectory({visible,screens,current,onChoose,onClose,onReset}:{
  visible:boolean;screens:DesignScreen[];current:number;onChoose:(n:number)=>void;onClose:()=>void;onReset:()=>void;
}){
  const {isDark,colors}=useTheme();
  const [query,setQuery]=useState('');
  const filtered=useMemo(()=>screens.filter(s=>(s.number+' '+s.name).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))),[screens,query]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{flex:1,backgroundColor:colors.background}}>
      <View style={{flex:1,padding:20,gap:16}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text style={{fontFamily:'Manrope_800ExtraBold',fontSize:22,color:colors.accent}}>EcoFit · 100 màn hình</Text>
          <Pressable onPress={onClose} accessibilityLabel="Đóng danh mục" style={{padding:12}}><Text style={{fontFamily:font,fontSize:24,color:colors.text}}>×</Text></Pressable>
        </View>
        <TextInput accessibilityLabel="Tìm màn hình" value={query} onChangeText={setQuery} placeholder="Tìm theo số hoặc tên màn hình" placeholderTextColor={colors.muted} selectionColor={colors.accent} keyboardAppearance={isDark?'dark':'light'} style={{backgroundColor:colors.input,color:colors.text,borderRadius:16,padding:16,fontFamily:font,fontSize:14}}/>
        <FlatList data={filtered} keyExtractor={item=>item.id} keyboardShouldPersistTaps="handled"
          renderItem={({item})=><Pressable onPress={()=>onChoose(item.number)} accessibilityLabel={'Màn hình '+item.number}
            style={{padding:16,marginBottom:8,borderRadius:16,backgroundColor:item.number===current?colors.secondary:colors.surface,flexDirection:'row',gap:12}}>
            <Text style={{fontFamily:'Manrope_700Bold',color:colors.accent,width:34}}>{String(item.number).padStart(3,'0')}</Text>
            <Text style={{fontFamily:font,color:colors.text,flex:1}}>{item.name.replace(/^\d+[ •·]+/,'')}</Text>
          </Pressable>}/>
        <Pressable onPress={onReset} style={{padding:12,alignItems:'center'}}><Text style={{fontFamily:font,color:colors.muted}}>Đặt lại dữ liệu mẫu</Text></Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}
