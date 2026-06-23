"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import Loading from '../loading/GlobalLoader';
import layout from "../../layout.module.css";

const TableEditor = dynamic(() => import('./TableEditor'), {
    ssr: false,
    loading: () => <Loading/>
});

export default function TableEditorLoader({ initialHtml }) {
    return (
        <div className={layout.bgWrap}>
            <div className={`${layout.container}`}>
                <TableEditor initialHtml={initialHtml} />
            </div>
        </div>
    );
}
