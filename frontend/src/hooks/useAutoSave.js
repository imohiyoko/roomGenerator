import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export const useAutoSave = () => {
    const currentProjectId = useStore(state => state.currentProjectId);
    const localAssets = useStore(state => state.localAssets);
    const instances = useStore(state => state.instances);
    const projectDefaultColors = useStore(state => state.projectDefaultColors);
    const saveProjectData = useStore(state => state.saveProjectData);
    const autoSaveInterval = useStore(state => state.autoSaveInterval);

    // 未保存の変更があるかどうかを追跡
    const hasPendingChanges = useRef(false);
    const saveRef = useRef(saveProjectData);
    saveRef.current = saveProjectData;

    // デバウンス付き自動保存
    useEffect(() => {
        if (!currentProjectId) return;
        hasPendingChanges.current = true;
        const delay = autoSaveInterval || 30000;
        const timer = setTimeout(() => {
            saveProjectData();
            hasPendingChanges.current = false;
        }, delay);
        return () => clearTimeout(timer);
    }, [localAssets, instances, projectDefaultColors, currentProjectId, saveProjectData, autoSaveInterval]);

    // アンマウント時（ページ離脱・画面遷移時）に未保存の変更を即座に保存
    useEffect(() => {
        return () => {
            if (hasPendingChanges.current) {
                saveRef.current();
            }
        };
    }, []);
};
