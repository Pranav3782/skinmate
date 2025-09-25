document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const imageUpload = document.getElementById('imageUpload');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const productTypeSelect = document.getElementById('productType');
    const extractedIngredients = document.getElementById('extractedIngredients');
    const analyzeButton = document.getElementById('analyzeButton');
    const resultsSection = document.getElementById('resultsSection');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const errorMessage = document.getElementById('errorMessage');
    const downloadSection = document.getElementById('downloadSection');

    const analysisCard = document.querySelector('.analysis-card');
    const analysisSummary = document.getElementById('analysisSummary');
    const analysisChartCanvas = document.getElementById('analysisChart');
    const goodCountEl = document.getElementById('goodCount');
    const neutralCountEl = document.getElementById('neutralCount');
    const cautionCountEl = document.getElementById('cautionCount');
    const toggleDetailsBtn = document.getElementById('toggleDetailsBtn');
    const detailedAnalysis = document.getElementById('detailedAnalysis');
    const downloadPdfBtn = document.getElementById('downloadPdf');
    const downloadPngBtn = document.getElementById('downloadPng');

    let analysisChartInstance = null;
    const API_BASE_URL = "http://localhost:8000";

    // --- UI State Management ---
    function showLoadingState(isAnalyzing) {
        analysisSummary.style.display = 'none';
        toggleDetailsBtn.style.display = 'none';
        detailedAnalysis.style.display = 'none';
        downloadSection.style.display = 'none';
        errorMessage.style.display = 'none';
        
        resultsSection.style.display = 'flex';
        loadingSpinner.style.display = 'block';

        if (isAnalyzing) {
            analyzeButton.disabled = true;
            analyzeButton.querySelector('span').textContent = 'Analyzing...';
        }
    }

    function hideLoadingState() {
        loadingSpinner.style.display = 'none';
        analyzeButton.disabled = false;
        analyzeButton.querySelector('span').textContent = 'Analyze Ingredients';
    }

    function displayError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        resultsSection.style.display = 'flex';
        analysisSummary.style.display = 'none';
        toggleDetailsBtn.style.display = 'none';
        downloadSection.style.display = 'none';
    }

    // --- Core Logic ---
    imageUpload.addEventListener('change', async (event) => {
        const uploadedImageFile = event.target.files[0];
        if (!uploadedImageFile) {
            fileNameDisplay.textContent = "";
            extractedIngredients.value = "";
            return;
        }

        fileNameDisplay.textContent = `Selected: ${uploadedImageFile.name}`;
        extractedIngredients.value = "Extracting ingredients from image...";
        showLoadingState(false);

        const formData = new FormData();
        formData.append('image', uploadedImageFile);
        formData.append('product_type', productTypeSelect.value);

        try {
            const response = await fetch(`${API_BASE_URL}/extract`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const ingredientsText = data.ingredients || "No text extracted.";
            extractedIngredients.value = ingredientsText;

            if (data.ingredients) {
                await performAnalysis(ingredientsText);
            } else {
                 hideLoadingState();
                 displayError(data.warning || "Could not extract any ingredients from the image.");
            }

        } catch (error) {
            console.error("Error during OCR extraction:", error);
            displayError(`Failed to extract ingredients: ${error.message}`);
            extractedIngredients.value = "Failed to extract ingredients.";
            hideLoadingState();
        }
    });

    async function performAnalysis(ingredientsText) {
        const productType = productTypeSelect.value;
        if (!ingredientsText || ingredientsText === "No text extracted.") {
            displayError("No ingredients to analyze.");
            return;
        }
        showLoadingState(true);

        try {
            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ingredients: ingredientsText,
                    product_type: productType
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.result || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("RAW RESPONSE FROM SERVER:", data.result); // For debugging
            const analysisText = data.result;

            // ✨ --- NEW: More Flexible Parsing Logic --- ✨
            // This logic is less strict and can handle variations in the AI response.
            const beneficialMatch = analysisText.match(/beneficial ingredients\s*✅?:\s*([\s\S]*?)(?=\n\s*(\d+\.|harmful|neutral|suitability)|$)/i);
            const harmfulMatch = analysisText.match(/harmful ingredients\s*❌?:\s*([\s\S]*?)(?=\n\s*(\d+\.|beneficial|neutral|suitability)|$)/i);
            const neutralMatch = analysisText.match(/neutral(?:.+)ingredients\s*⚠️?:\s*([\s\S]*?)(?=\n\s*(\d+\.|beneficial|harmful|suitability)|$)/i);

            // This now counts both '*' and '-' as bullet points.
            const goodCount = beneficialMatch && beneficialMatch[1] ? (beneficialMatch[1].match(/[\*\-]/g) || []).length : 0;
            const cautionCount = harmfulMatch && harmfulMatch[1] ? (harmfulMatch[1].match(/[\*\-]/g) || []).length : 0;
            const neutralCount = neutralMatch && neutralMatch[1] ? (neutralMatch[1].match(/[\*\-]/g) || []).length : 0;
            
            const analysisData = { good: goodCount, neutral: neutralCount, caution: cautionCount };
            
            // If all counts are zero after parsing, it's likely the format is completely unexpected.
            if (goodCount === 0 && cautionCount === 0 && neutralCount === 0) {
                 console.warn("Could not parse ingredient counts from the AI response. Check the format.");
            }

            const formattedHtml = formatAnalysisToHtml(analysisText);

            goodCountEl.textContent = goodCount;
            neutralCountEl.textContent = neutralCount;
            cautionCountEl.textContent = cautionCount;
            detailedAnalysis.innerHTML = formattedHtml;

            renderAnalysisChart(analysisData);
            
            analysisSummary.style.display = 'block';
            toggleDetailsBtn.style.display = 'block';
            toggleDetailsBtn.textContent = 'Show Details';
            downloadSection.style.display = 'block';

        } catch (error) {
            console.error("Error during analysis:", error);
            displayError(`Analysis failed: ${error.message}`);
        } finally {
            hideLoadingState();
        }
    }
    
    analyzeButton.addEventListener('click', () => {
        const ingredientsText = extractedIngredients.value.trim();
        performAnalysis(ingredientsText);
    });

    // --- Helper Functions ---
    function formatAnalysisToHtml(text) {
        let html = text.replace(/Harmful Ingredients ❌:/gi, '<strong class="text-caution">Harmful Ingredients ❌:</strong>')
                       .replace(/Beneficial Ingredients ✅:/gi, '<strong class="text-beneficial">Beneficial Ingredients ✅:</strong>')
                       .replace(/Neutral\/Conditional Ingredients ⚠️:/gi, '<strong class="text-neutral">Neutral/Conditional Ingredients ⚠️:</strong>')
                       .replace(/Suitability Recommendation 🎯:/gi, '<strong>Suitability Recommendation 🎯:</strong>');

        const lines = html.split('\n').filter(line => line.trim() !== '');
        let listHtml = '';
        lines.forEach(line => {
            let trimmedLine = line.trim();
            if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                listHtml += `<li>${trimmedLine.substring(2)}</li>`;
            } else {
                listHtml += `<li>${trimmedLine}</li>`;
            }
        });

        return `<ul>${listHtml}</ul>`;
    }
    
    toggleDetailsBtn.addEventListener('click', () => {
        const isHidden = detailedAnalysis.style.display === 'none';
        detailedAnalysis.style.display = isHidden ? 'block' : 'none';
        toggleDetailsBtn.textContent = isHidden ? 'Hide Details' : 'Show Details';
    });

    async function captureAndDownload(format) {
        const initialDisplay = detailedAnalysis.style.display;
        const initialBtnText = toggleDetailsBtn.textContent;

        detailedAnalysis.style.display = 'block';
        toggleDetailsBtn.textContent = 'Hide Details';
        analysisCard.classList.add('capture-mode');

        await new Promise(resolve => setTimeout(resolve, 50));

        html2canvas(analysisCard, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        }).then(canvas => {
            if (format === 'png') {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = 'SkinMate_Analysis.png';
                link.click();
            } else if (format === 'pdf') {
                const { jsPDF } = window.jspdf;
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'px',
                    format: [imgWidth, imgHeight]
                });
                doc.addImage(imgData, 'PNG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
                doc.save('SkinMate_Analysis.pdf');
            }

            analysisCard.classList.remove('capture-mode');
            detailedAnalysis.innerHTML = originalHTML; 
            detailedAnalysis.style.display = initialDisplay;
            toggleDetailsBtn.textContent = initialBtnText;
        });
    }

    downloadPngBtn.addEventListener('click', () => captureAndDownload('png'));
    downloadPdfBtn.addEventListener('click', () => captureAndDownload('pdf'));

    function renderAnalysisChart(data) {
        if (analysisChartInstance) {
            analysisChartInstance.destroy();
        }
        const ctx = analysisChartCanvas.getContext('2d');
        analysisChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Beneficial', 'Neutral', 'Caution'],
                datasets: [{
                    label: 'Ingredient Analysis',
                    data: [data.good, data.neutral, data.caution],
                    backgroundColor: ['#4CAF50', '#FFC107', '#F44336'],
                    borderColor: '#F7F9F9', 
                    borderWidth: 4,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#2c3e50',
                        titleFont: { size: 14, weight: '600' },
                        bodyFont: { size: 12 },
                        padding: 10,
                        cornerRadius: 5
                    }
                }
            }
        });
    }
});