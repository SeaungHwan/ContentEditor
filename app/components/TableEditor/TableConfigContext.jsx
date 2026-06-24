/*
 * [TableConfigContext.jsx] 테이블/컨텐츠 변환 설정 전역 상태 컨텍스트
 *
 * 역할:
 *   - 에디터 전체에서 공유하는 변환 설정(config) 상태를 관리한다.
 *   - UIStateContext와 동일하게 상태/액션 컨텍스트를 분리해 리렌더링을 최적화한다.
 *
 * 초기 설정값(initialConfig) 주요 항목:
 *   - wrapperClassName   : 테이블을 감싸는 div 클래스 (기본값: 'tbl-st')
 *   - ulClassName        : 일반 텍스트 영역의 ul 클래스 (기본값: 'bu-st')
 *   - olType             : ol로 변환할 마커 타입 목록 (복수 선택 가능)
 *   - keepMarker         : 리스트 변환 시 원본 기호 문자를 유지할지 여부
 *   - tableUlClassName   : 테이블 내부 전용 ul 클래스 (일반 텍스트와 별도 적용)
 *   - tableOlType        : 테이블 내부 전용 ol 타입 목록
 *   - isColorMode        : 텍스트 색상을 pc_xxx 클래스로 변환할지 여부
 *   - tableIsColorMode   : 테이블 내부 색상을 pc_xxx 클래스로 변환할지 여부
 *   - isWrapDiv          : table을 div로 감쌀지 여부
 *   - isVerticalHeader   : th 내용을 세로(한 글자씩 + br) 방향으로 표시할지 여부
 *   - headerRows/Cols    : thead 또는 좌측 헤더(th scope="row") 범위 행/열 수
 *   - tit1/tit2/tit3     : 제목 감지 설정 (type: 'custom'|'number-dot'|... , val: 직접입력값) → h3/h4/h5
 *   - tit1Class~tit3Class: 변환된 h3~h5에 적용할 클래스명
 *
 * 제공 액션:
 *   updateConfig(key, value)       → 단일 필드 변경
 *   updateMultipleConfig(payload)  → 여러 필드 일괄 변경 (모달 적용 시 사용)
 *   handleTableTypeChange(type)    → tableType 변경 + headerRows/headerCols 초기화
 *
 * 사용처:
 *   - TableEditor, GlobalTableConfigModal, ContentConfigModal, TableEditModal
 */
"use client";
import React, { createContext, useContext, useReducer, useMemo } from "react";

const initialConfig = {
    wrapperClassName: 'tbl_st',

    // ✨ 일반 텍스트(컨텐츠) 전용 리스트 설정
    ulClassName: 'list_st',
    olType: [],
    keepMarker: false,
    useAtteMarker: false,

    // ✨ 표(Table) 내부 전용 리스트 설정 추가
    tableUlClassName: 'list_st',
    tableOlType: [],
    tableKeepMarker: false,
    tableUseAtteMarker: false,

    tableType: 'default',
    isColorMode: false,
    isColorClassMode: true,
    tableIsColorMode: false,
    tableIsColorClassMode: true,
    isWrapDiv: true,
    isVerticalHeader: false,

    headerRows: 1,
    headerCols: 1,
    tit1: { type: 'custom', val: '' },
    tit2: { type: 'custom', val: '' },
    tit3: { type: 'custom', val: '' },
    tit1Class: 'tit1',
    tit2Class: 'tit2',
    tit3Class: 'tit3',

};

function configReducer(state, action) {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.key]: action.value };
        case 'UPDATE_MULTIPLE':
            return { ...state, ...action.payload };
        case 'SET_TABLE_TYPE':
            return {
                ...state,
                tableType: action.value,
                headerRows: 1,
                headerCols: 1
            };
        default:
            return state;
    }
}


const TableConfigStateContext = createContext();
const TableConfigDispatchContext = createContext();

export function TableConfigProvider({ children }) {
    const [config, dispatchConfig] = useReducer(configReducer, initialConfig);

    const dispatchers = useMemo(() => {
        return {
            updateConfig: (key, value) => dispatchConfig({ type: 'SET_FIELD', key, value }),
            updateMultipleConfig: (payload) => dispatchConfig({ type: 'UPDATE_MULTIPLE', payload }),
            handleTableTypeChange: (type) => dispatchConfig({ type: 'SET_TABLE_TYPE', value: type })
        };
    }, []); 

    return (
        <TableConfigDispatchContext.Provider value={dispatchers}>
            <TableConfigStateContext.Provider value={config}>
                {children}
            </TableConfigStateContext.Provider>
        </TableConfigDispatchContext.Provider>
    );
}

export function useTableConfig() {
    return useContext(TableConfigStateContext);
}

export function useTableConfigDispatch() {
    return useContext(TableConfigDispatchContext);
}