// This is a placeholder for a Redux/Zustand slice
export const projectSlice = {
    name: 'projects',
    initialState: {
        items: [],
        currentProject: null,
        loading: false
    },
    reducers: {
        setProjects: (state: any, action: any) => {
            state.items = action.payload;
        }
    }
};
