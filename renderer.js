 window.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM loaded, checking electronAPI:', window.electronAPI);
        const textarea = document.getElementById('note');
        const saveBtn = document.getElementById('save');
        const saveAsBtn = document.getElementById('save-as');
        const openFileBtn = document.getElementById('open-file');
        const newNoteBtn = document.getElementById('new-note');
        const statusEl = document.getElementById('save_status');
        const celebration = document.getElementById('celebration');
        const starContainer = document.getElementById('starContainer');

        console.log('Elements found:', { textarea, saveBtn, saveAsBtn, openFileBtn, newNoteBtn, statusEl });

        const savedNote = await window.electronAPI.loadNote();
        textarea.value = savedNote || '';
        let lastSavedText = textarea.value;

        const hasUnsavedChanges = () => textarea.value !== lastSavedText;

        const confirmDiscardChanges = () => {
            if (!hasUnsavedChanges()) return true;
            return window.confirm('You have unsaved changes. Continue and discard them?');
        };

        const showCelebration = (message) => {
            celebration.textContent = `🎉 ${message} 🎉`;
            celebration.classList.add('show');
            setTimeout(() => {
                celebration.classList.remove('show');
            }, 1500);
        };

        const spawnFallingStars = (count = 28) => {
            for (let i = 0; i < count; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                const size = 3 + Math.random() * 8;
                const left = Math.random() * 100;
                const duration = 5 + Math.random() * 0.5;
                const delay = Math.random() * 0.15;
                star.style.width = `${size}px`;
                star.style.height = `${size}px`;
                star.style.left = `${left}%`;
                star.style.animationDuration = `${duration}s`;
                star.style.animationDelay = `${delay}s`;
                starContainer.appendChild(star);
                setTimeout(() => star.remove(), (duration + delay) * 1000 + 50);
            }
        };

        saveBtn.addEventListener('click', async () => {
            try {
                console.log('Save button clicked');
                const result = await window.electronAPI.saveNote(textarea.value);
                lastSavedText = textarea.value;
                statusEl.textContent = `Saved to: ${result.filePath}`;
                spawnFallingStars();
                showCelebration('Note saved successfully');
            } catch (error) {
                console.error('Error saving note:', error);
                statusEl.textContent = 'Error saving note';
            }
        });

        saveAsBtn.addEventListener('click', async () => {
            try {
                console.log('Save As button clicked');
                const result = await window.electronAPI.saveAs(textarea.value);
                if (result.success) {
                    lastSavedText = textarea.value;
                    currentFilePath = result.filePath;
                    statusEl.textContent = `Saved to: ${result.filePath}`;
                    showCelebration('Saved as text file');
                } else {
                    statusEl.textContent = 'Save as canceled.';
                }
            } catch (error) {
                console.error('Error saving as:', error);
                statusEl.textContent = 'Error saving as';
            }
        });

        newNoteBtn.addEventListener('click', () => {
            console.log('New Note button clicked');
            if (confirmDiscardChanges()) {
                textarea.value = '';
                lastSavedText = '';
                statusEl.textContent = 'New note started';
            } else {
                statusEl.textContent = 'New note cancelled';
            }
        });

        openFileBtn.addEventListener('click', async () => {
            try {
                console.log('Open File button clicked');
                const result = await window.electronAPI.openFile();
                if (result.success) {
                    textarea.value = result.content;
                    lastSavedText = result.content;
                    statusEl.textContent = `Opened: ${result.filePath}`;
                    showCelebration('File opened successfully');
                } else {
                    statusEl.textContent = 'Open file canceled.';
                }
            } catch (error) {
                console.error('Error opening file:', error);
                statusEl.textContent = 'Error opening file';
            }
        });

        window.electronAPI.onMenuAction('menu-new-note', () => newNoteBtn.click());
        window.electronAPI.onMenuAction('menu-open-file', () => openFileBtn.click());
        window.electronAPI.onMenuAction('menu-save', () => saveBtn.click());
        window.electronAPI.onMenuAction('menu-save-as', () => saveAsBtn.click());

        console.log('Event listeners attached');
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
    }
});
 
