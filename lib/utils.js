function randomAlphanumeric(len) {
	const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const setLength = charSet.length;
	let str = '';
	for (let i = 0; i < len; i += 1) {
		str += charSet.charAt(Math.floor(Math.random() * setLength));
	}
	return str;
}

function positiveIntOrDefault(val, def) {
	return Number.isInteger(val) && val >= 0 ? val : def;
}

function ensureDict(dict) {
	return dict instanceof Object ? dict : {};
}

function parseJsonDict(json) {
	try {
		const dict = JSON.parse(json);
		return ensureDict(dict);
	} catch (err) {
		return {};
	}
}

const now = () => Date.now();

module.exports = {
	randomAlphanumeric,
	positiveIntOrDefault,
	ensureDict,
	parseJsonDict,
	now,
};
