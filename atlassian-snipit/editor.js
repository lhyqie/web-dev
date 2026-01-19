// State
let canvas, ctx;
let backgroundImage = null;
let isDrawing = false;
let startX, startY;
const history = []; // Stack of shapes
const redoHistory = []; // Stack of redone shapes
let currentShape = null; // The shape currently being drawn
let currentTool = 'arrow';
let currentColor = '#FF0000';
let currentLineWidth = 3;
let currentFontSize = 24;
let originalUrl = '';
let selectedShapeIndex = -1;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// DOM Elements
const toolbarBtns = document.querySelectorAll('.tool-btn[data-tool]');
const colorPicker = document.getElementById('color-picker');
const lineWidthSlider = document.getElementById('line-width');
const fontSizeSelect = document.getElementById('font-size');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const uploadBtn = document.getElementById('upload-btn');
const viewAllBtn = document.getElementById('view-all-btn');
const textInput = document.getElementById('text-input');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    // Load data from storage
    const data = await chrome.storage.local.get(['screenshotDataUrl', 'originalUrl']);
    if (data.screenshotDataUrl) {
        loadImage(data.screenshotDataUrl);
        originalUrl = data.originalUrl;
    }

    setupEventListeners();
});

function loadImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
        backgroundImage = img;
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Scale display size for high DPI displays to look "natural" size
        // We assume the image was captured at the device's native resolution
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = (img.width / dpr) + 'px';
        canvas.style.height = (img.height / dpr) + 'px';
        
        draw();
    };
    img.src = dataUrl;
}

function setupEventListeners() {
    // Toolbar
    toolbarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolbarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;

            if (currentTool === 'text') {
                lineWidthSlider.style.display = 'none';
                fontSizeSelect.style.display = 'block';
            } else if (currentTool === 'select') {
                lineWidthSlider.style.display = 'none';
                fontSizeSelect.style.display = 'none';
            } else {
                lineWidthSlider.style.display = 'block';
                fontSizeSelect.style.display = 'none';
            }
            
            // Clear selection when switching tools
            if (currentTool !== 'select') {
                selectedShapeIndex = -1;
                draw();
            }
        });
    });

    const updateColor = (e) => {
        currentColor = e.target.value;
        if (textInput.style.display === 'block') {
            textInput.style.color = currentColor;
            textInput.focus(); // Keep focus
        }
    };

    colorPicker.addEventListener('change', updateColor);
    colorPicker.addEventListener('input', updateColor);

    lineWidthSlider.addEventListener('input', (e) => {
        currentLineWidth = parseInt(e.target.value, 10);
    });

    fontSizeSelect.addEventListener('change', (e) => {
        currentFontSize = parseInt(e.target.value, 10);
        if (textInput.style.display === 'block') {
             textInput.style.fontSize = currentFontSize + 'px';
             textInput.style.width = (parseInt(textInput.style.fontSize) * 10) + 'px';
             textInput.style.height = (parseInt(textInput.style.fontSize) * 1.5) + 'px';
             textInput.focus();
        }
    });

    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
            // Allow default undo behavior in the text input
            if (document.activeElement === textInput) {
                return;
            }
            
            e.preventDefault();
            undo();
        } else if (((e.metaKey || e.ctrlKey) && e.key === 'y') || ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey)) {
             e.preventDefault();
             redo();
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIndex !== -1) {
            // Delete selected shape
            e.preventDefault();
            history.splice(selectedShapeIndex, 1);
            selectedShapeIndex = -1;
            redoHistory.length = 0;
            draw();
        }
    });

    uploadBtn.addEventListener('click', uploadScreenshot);
    viewAllBtn.addEventListener('click', () => {
        window.open('https://go/screenshot', '_blank');
    });

    // Canvas Mouse Events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Text Input Events
    textInput.addEventListener('blur', finalizeText);
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            finalizeText();
        }
        if (e.key === 'Escape') {
            textInput.style.display = 'none';
            textInput.value = '';
            isDrawing = false;
        }
        // Resize textarea as you type
        requestAnimationFrame(() => {
           textInput.style.height = 'auto';
           textInput.style.height = textInput.scrollHeight + 'px';
           textInput.style.width = 'auto';
           textInput.style.width = (textInput.scrollWidth + 10) + 'px';
        });
    });
}

function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function handleMouseDown(e) {
    const pos = getMousePos(canvas, e);
    const x = pos.x;
    const y = pos.y;

    if (currentTool === 'text') {
        e.preventDefault(); // Prevent default to avoid immediate focus loss
        if (textInput.style.display === 'block') {
            finalizeText();
        } else {
            startText(e, x, y);
        }
        return;
    }

    if (currentTool === 'select') {
        // Check if clicking on a shape
        selectedShapeIndex = -1;
        for (let i = history.length - 1; i >= 0; i--) {
            if (isPointInShape(x, y, history[i])) {
                selectedShapeIndex = i;
                isDragging = true;
                const shape = history[i];
                dragOffsetX = x - (shape.x1 || 0);
                dragOffsetY = y - (shape.y1 || 0);
                draw();
                return;
            }
        }
        draw();
        return;
    }

    isDrawing = true;
    startX = x;
    startY = y;
}

function handleMouseMove(e) {
    if (currentTool === 'select' && isDragging && selectedShapeIndex !== -1) {
        const pos = getMousePos(canvas, e);
        const shape = history[selectedShapeIndex];
        const dx = pos.x - dragOffsetX - shape.x1;
        const dy = pos.y - dragOffsetY - shape.y1;
        
        // Move the shape
        shape.x1 += dx;
        shape.y1 += dy;
        if (shape.x2 !== undefined) {
            shape.x2 += dx;
            shape.y2 += dy;
        }
        
        draw();
        return;
    }

    if (!isDrawing) return;

    const pos = getMousePos(canvas, e);
    const currentX = pos.x;
    const currentY = pos.y;

    currentShape = {
        type: currentTool,
        x1: startX,
        y1: startY,
        x2: currentX,
        y2: currentY,
        color: currentColor,
        width: currentLineWidth
    };

    draw();
}

function handleMouseUp(e) {
    if (isDragging) {
        isDragging = false;
        redoHistory.length = 0;
        return;
    }
    
    if (!isDrawing) return;
    isDrawing = false;
    if (currentShape) {
        history.push(currentShape);
        redoHistory.length = 0; // Clear redo history
        currentShape = null;
    }
    draw();
}

function undo() {
    if (history.length > 0) {
        const shape = history.pop();
        redoHistory.push(shape);
        draw();
    }
}

function redo() {
    if (redoHistory.length > 0) {
        const shape = redoHistory.pop();
        history.push(shape);
        draw();
    }
}

// Drawing Functions
function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background
    if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0);
    }

    // Draw History
    history.forEach(shape => drawShape(shape));

    // Draw Current Shape
    if (currentShape) {
        drawShape(currentShape);
    }
    
    // Draw selection indicator
    if (selectedShapeIndex !== -1 && selectedShapeIndex < history.length) {
        const shape = history[selectedShapeIndex];
        drawSelectionBox(shape);
    }
}

function drawShape(shape) {
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.color;
    ctx.lineWidth = shape.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    if (shape.type === 'rect') {
        ctx.strokeRect(shape.x1, shape.y1, shape.x2 - shape.x1, shape.y2 - shape.y1);
    } else if (shape.type === 'ellipse') {
        const x = (shape.x1 + shape.x2) / 2;
        const y = (shape.y1 + shape.y2) / 2;
        const rx = Math.abs(shape.x2 - shape.x1) / 2;
        const ry = Math.abs(shape.y2 - shape.y1) / 2;
        
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
    } else if (shape.type === 'arrow') {
        drawArrow(ctx, shape.x1, shape.y1, shape.x2, shape.y2);
    } else if (shape.type === 'text') {
        ctx.font = `${shape.size}px Arial`; // Use stored size
        ctx.fillText(shape.text, shape.x1, shape.y1);
    }
}

function drawArrow(ctx, fromx, fromy, tox, toy) {
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Scale arrowhead proportionally to line width
    const headlen = Math.max(15, ctx.lineWidth * 4);
    const headWidth = Math.max(10, ctx.lineWidth * 2.5);
    
    // Shorten the line so it doesn't extend beyond the arrowhead
    const shortenBy = headlen * 0.6;
    const shortenRatio = Math.max(0, (length - shortenBy) / length);
    const lineEndX = fromx + dx * shortenRatio;
    const lineEndY = fromy + dy * shortenRatio;

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();

    // Draw arrow head as a filled triangle
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(
        tox - headlen * Math.cos(angle) + headWidth * Math.sin(angle),
        toy - headlen * Math.sin(angle) - headWidth * Math.cos(angle)
    );
    ctx.lineTo(
        tox - headlen * Math.cos(angle) - headWidth * Math.sin(angle),
        toy - headlen * Math.sin(angle) + headWidth * Math.cos(angle)
    );
    ctx.closePath();
    ctx.fill();
}

function isPointInShape(x, y, shape) {
    const padding = 10;
    
    if (shape.type === 'text') {
        // Approximate text bounds
        const textWidth = shape.text.length * shape.size * 0.6;
        return x >= shape.x1 - padding && x <= shape.x1 + textWidth + padding &&
               y >= shape.y1 - shape.size && y <= shape.y1 + padding;
    } else if (shape.type === 'rect') {
        const minX = Math.min(shape.x1, shape.x2);
        const maxX = Math.max(shape.x1, shape.x2);
        const minY = Math.min(shape.y1, shape.y2);
        const maxY = Math.max(shape.y1, shape.y2);
        return x >= minX - padding && x <= maxX + padding &&
               y >= minY - padding && y <= maxY + padding;
    } else if (shape.type === 'ellipse') {
        const cx = (shape.x1 + shape.x2) / 2;
        const cy = (shape.y1 + shape.y2) / 2;
        const rx = Math.abs(shape.x2 - shape.x1) / 2;
        const ry = Math.abs(shape.y2 - shape.y1) / 2;
        const normalized = ((x - cx) ** 2) / (rx + padding) ** 2 + ((y - cy) ** 2) / (ry + padding) ** 2;
        return normalized <= 1;
    } else if (shape.type === 'arrow') {
        // Check if point is near the line segment
        const dist = distanceToLineSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2);
        return dist <= (shape.width || 3) + padding;
    }
    return false;
}

function distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function drawSelectionBox(shape) {
    ctx.save();
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    let minX, minY, maxX, maxY;
    
    if (shape.type === 'text') {
        const textWidth = shape.text.length * shape.size * 0.6;
        minX = shape.x1 - 5;
        minY = shape.y1 - shape.size - 5;
        maxX = shape.x1 + textWidth + 5;
        maxY = shape.y1 + 5;
    } else {
        minX = Math.min(shape.x1, shape.x2 || shape.x1) - 10;
        minY = Math.min(shape.y1, shape.y2 || shape.y1) - 10;
        maxX = Math.max(shape.x1, shape.x2 || shape.x1) + 10;
        maxY = Math.max(shape.y1, shape.y2 || shape.y1) + 10;
    }
    
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
}

// Text Tool Functions
function startText(e, x, y) {
    // Determine font size based on line width
    // Visual size in CSS pixels should look consistent, but we draw on high-res canvas.
    // So font size should be scaled up!
    // But textInput is a DOM element Overlay. It should be visually sized same as it will be drawn.
    
    // Position the text input overlay visually (absolute screen coords)
    // e.clientX/Y are correct for visually positioning the fixed/absolute text area
    textInput.style.left = (e.clientX) + 'px';
    textInput.style.top = (e.clientY) + 'px';
    textInput.style.color = currentColor;
    
    const baseFontSize = currentFontSize;
    textInput.style.fontSize = baseFontSize + 'px'; 
    textInput.style.display = 'block';
    
    // Position the textarea relative to the canvas CONTAINER, but visual position is absolute
    // Actually, better to use fixed positioning or relative to a wrapper. 
    // Let's use left/top from event relative to viewport since display: fixed/absolute
    
    // Store canvas relative coordinates for final drawing
    textInput.dataset.x = x;
    
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    textInput.dataset.scale = scale; // Store scale for finalize
    
    // Adjust y for baseline
    textInput.dataset.y = y + (baseFontSize * 0.8 * scale);


    textInput.value = '';
    
    // Ensure it has size initially
    textInput.style.width = (parseInt(textInput.style.fontSize) * 10) + 'px'; // Give it more width initially
    textInput.style.height = (parseInt(textInput.style.fontSize) * 1.5) + 'px';

    setTimeout(() => {
        textInput.focus();
    }, 10);
}

function finalizeText() {
    if (textInput.style.display === 'none') return;

    const text = textInput.value;
    if (text.trim()) {
        const scale = parseFloat(textInput.dataset.scale || 1);
        const cssFontSize = parseInt(textInput.style.fontSize);
        const canvasFontSize = cssFontSize * scale;

        history.push({
            type: 'text',
            text: text,
            x1: parseFloat(textInput.dataset.x),
            y1: parseFloat(textInput.dataset.y),
            color: textInput.style.color,
            width: 1, // Not used for text fill
            size: canvasFontSize
        });
        redoHistory.length = 0; // Clear redo history
        draw();
    }

    textInput.style.display = 'none';
    textInput.value = '';
    isDrawing = false;
}

// Upload
async function uploadScreenshot() {
    draw(); // Ensure everything is drawn
    const dataUrl = canvas.toDataURL('image/png');
    
    // Send to background
    const response = await chrome.runtime.sendMessage({
        type: 'upload-annotated-image',
        dataUrl: dataUrl,
        url: originalUrl
    });
    
    // Close this tab? Or show success message?
    // Let background handle the navigation to the uploaded image page.
    window.close();
}
