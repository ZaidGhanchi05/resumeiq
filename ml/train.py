"""Train and compare classifiers on both text variants. Saves best model + full metrics."""
import json, time, joblib, numpy as np, pandas as pd, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt, seaborn as sns
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import ComplementNB
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, classification_report, confusion_matrix
from xgboost import XGBClassifier

SEED=42; BLUE="#2563EB"
df=pd.read_csv("data/processed/resumes_clean.csv")
le=LabelEncoder().fit(df.Category); y=le.transform(df.Category)

def tfidf(max_f=20000): return TfidfVectorizer(stop_words="english",ngram_range=(1,2),min_df=3,max_features=max_f,sublinear_tf=True)
def models():
    return {
     "Complement NB": Pipeline([("t",tfidf()),("m",ComplementNB(alpha=0.3))]),
     "Logistic Regression": Pipeline([("t",tfidf()),("m",LogisticRegression(C=10,max_iter=2000))]),
     "Linear SVM": Pipeline([("t",tfidf()),("m",LinearSVC(C=0.5))]),
     "Random Forest": Pipeline([("t",tfidf(8000)),("m",RandomForestClassifier(300,n_jobs=-1,random_state=SEED))]),
     "XGBoost": Pipeline([("t",tfidf(5000)),("m",XGBClassifier(n_estimators=150,max_depth=5,learning_rate=0.2,subsample=0.8,colsample_bytree=0.5,tree_method="hist",n_jobs=-1,random_state=SEED))]),
    }
results=[]; best={}
for variant in ["text_full","text_no_title"]:
    Xtr,Xte,ytr,yte=train_test_split(df[variant],y,test_size=0.2,stratify=y,random_state=SEED)
    cv=StratifiedKFold(5,shuffle=True,random_state=SEED)
    for name,pipe in models().items():
        t0=time.time()
        cvs=cross_val_score(pipe,Xtr,ytr,cv=cv,scoring="accuracy",n_jobs=1)
        pipe.fit(Xtr,ytr); p=pipe.predict(Xte)
        row=dict(variant=variant,model=name,cv_acc_mean=cvs.mean(),cv_acc_std=cvs.std(),
            test_acc=accuracy_score(yte,p),macro_f1=f1_score(yte,p,average="macro"),
            macro_precision=precision_score(yte,p,average="macro",zero_division=0),macro_recall=recall_score(yte,p,average="macro",zero_division=0),
            train_seconds=time.time()-t0)
        results.append(row); print({k:(round(v,4) if isinstance(v,float) else v) for k,v in row.items()},flush=True)
        if variant not in best or row["macro_f1"]>best[variant][0]: best[variant]=(row["macro_f1"],name,pipe,Xte,yte,p)
R=pd.DataFrame(results); R.to_csv("reports/model_comparison.csv",index=False)

summary={}
for variant,(f1,name,pipe,Xte,yte,p) in best.items():
    rep=classification_report(yte,p,target_names=le.classes_,output_dict=True,zero_division=0)
    summary[variant]={"best_model":name,"test_accuracy":accuracy_score(yte,p),"macro_f1":f1,"per_class":{k:v for k,v in rep.items() if k in le.classes_},"n_test":int(len(yte))}
    cm=confusion_matrix(yte,p,normalize="true")
    plt.figure(figsize=(11,9)); sns.heatmap(cm,xticklabels=le.classes_,yticklabels=le.classes_,cmap="Blues",vmin=0,vmax=1)
    plt.title(f"Confusion matrix - {name} ({variant})"); plt.xticks(rotation=90,fontsize=7); plt.yticks(fontsize=7); plt.tight_layout()
    plt.savefig(f"reports/figures/05_confusion_{variant}.png",dpi=140); plt.close()
json.dump(summary,open("reports/best_model_summary.json","w"),indent=2)

# deployed model: stricter variant (no title) unless full is the only one useful -> we ship the no-title model for honesty on real resumes
ship=best["text_no_title"][2]
joblib.dump({"pipeline":ship,"classes":list(le.classes_),"name":best["text_no_title"][1]},"models/category_model.joblib",compress=3)

# model comparison chart
plt.figure(figsize=(9,5)); sns.barplot(data=R,x="model",y="test_acc",hue="variant",palette=[BLUE,"#F97316"])
plt.ylim(0.4,1); plt.xticks(rotation=15); plt.title("Test accuracy by model"); plt.tight_layout(); plt.savefig("reports/figures/06_model_comparison.png",dpi=140); plt.close()
print(json.dumps({k:{kk:vv for kk,vv in v.items() if kk!="per_class"} for k,v in summary.items()},indent=2))
