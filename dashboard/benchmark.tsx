import React, { useMemo } from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App';
// This benchmark will render the app to string 100 times to measure the impact of memoization
// We'd need to mock the data fetch though
