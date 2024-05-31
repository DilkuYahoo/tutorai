window.onload = function() {
	fetch('{{ url_for('static', filename='config.json') }}')
        	.then(response => response.json())
        	.then(data => {
        		Object.keys(data).forEach(key => {
        			const select = document.querySelector(`select[name="${key}"]`);
        			data[key].forEach(option => {
        			const opt = document.createElement('option');
        			opt.value = option;
        			opt.innerHTML = option;
        			select.appendChild(opt);
        			});
        		});
        	});
};
