import { useEffect } from 'react';
import { useStore } from '../store';

export const useAutoSave = () => {
    const currentProjectId = useStore(state => state.currentProjectId);
    const localAssets = useStore(state => state.localAssets);
    const instances = useStore(state => state.instances);
    const projectDefaultColors = useStore(state => state.projectDefaultColors);
    const saveProjectData = useStore(state => state.saveProjectData);

    useEffect(() => {
        if (!currentProjectId) return;
        const timer = setTimeout(() => {
            saveProjectData();
        }, 1000);
        return () => clearTimeout(timer);
    }, [localAssets, instances, projectDefaultColors, currentProjectId, saveProjectData]);
};
