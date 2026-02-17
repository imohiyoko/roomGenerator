import { useEffect } from 'react';
import { useStore } from '../store';

export const useAutoSave = () => {
    const currentProjectId = useStore(state => state.currentProjectId);
    const localAssets = useStore(state => state.localAssets);
    const instances = useStore(state => state.instances);
    const projectDefaultColors = useStore(state => state.projectDefaultColors);
    const saveProjectData = useStore(state => state.saveProjectData);
    const autoSaveInterval = useStore(state => state.autoSaveInterval);

    useEffect(() => {
        if (!currentProjectId) return;
        const delay = autoSaveInterval || 30000;
        const timer = setTimeout(() => {
            saveProjectData();
        }, delay);
        return () => clearTimeout(timer);
    }, [localAssets, instances, projectDefaultColors, currentProjectId, saveProjectData, autoSaveInterval]);
};
